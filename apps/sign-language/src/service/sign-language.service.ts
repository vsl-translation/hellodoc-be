import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SignLanguage } from 'apps/sign-language/core/sign_language.schema';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  // Giả sử các service AI đều nằm chung host này hoặc bạn có thể tách ra biến env riêng
  private SYNONISM_URL = process.env.SYNNONISM_URL; 
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;


  constructor(
    private readonly httpService: HttpService,
    @InjectModel(SignLanguage.name, "signLanguageConnection") private signLanguage: Model<SignLanguage>,
    @Inject ("PHOWHISPER_CLIENT") private phowhisperClient:ClientProxy,
    @Inject ("UNDERTHESEA_CLIENT") private undertheseaClient:ClientProxy
  ) {}

  async getGestureCode(urlMedia: string) {
    this.logger.log(`Processing gesture code for URL: ${urlMedia}`);

    // 1. Kiểm tra Cache trong DB
    if (urlMedia) {
      const existed = await this.signLanguage.findOne({ urlMedia });
      if (existed) {
        this.logger.log("Found cached data for urlMedia");
        return {
          cached: true,
          urlMedia: existed.urlMedia,
          signLanguage: existed.signLanguage // Đây là mảng gesture codes
        };
      }
    }

    try {
      // --- STEP 1: Get Subtitle ---
      // Input: urlMedia -> Output: String (VD: "Anh đang ăn cơm")
      this.logger.log(`Step 1: Fetching subtitle from `);
      
      const subtitleRes = await firstValueFrom(
        this.phowhisperClient.send(
          "", { videoUrl: urlMedia })
      );
      console.log(subtitleRes)
      const subtitleText = subtitleRes.data; // Giả sử API trả về text trực tiếp hoặc object { text: "..." }
      
      if (!subtitleText) throw new Error("Subtitle extraction failed");
      this.logger.debug(`Subtitle extracted: ${JSON.stringify(subtitleText)}`);
      console.log("Chạy được tới bước 1")


      // --- STEP 2: Tokenize (Underthesea) ---
      // Input: subtitleText -> Output: Array (VD: ["Anh", "ăn cơm", "ngon"])
      this.logger.log(`Step 2: Tokenizing text...`);

      const tokenizeRes = await firstValueFrom(
        this.undertheseaClient.send(
          'underthesea.tokenize', 
          { body: subtitleText }
        )
      );
      const tokens = tokenizeRes.data; // Mảng các từ

      if (!Array.isArray(tokens)) throw new Error("Tokenization failed to return an array");
      this.logger.debug(`Tokens: ${tokens}`);
      console.log("Chạy được tới bước 2")


      // --- STEP 3: Get Synonyms ---
      // Input: Array Tokens -> Output: Array Synonyms (đã map theo quy tắc)
      const synonymEndpoint = `${this.SYNONISM_URL}/search`;
      this.logger.log(`Step 3: Getting synonyms...`);

      const synonymRes = await firstValueFrom(
        this.httpService.post(synonymEndpoint, { words: tokens })
      );

      const synonyms = synonymRes.data;
      this.logger.debug(`Synonyms: ${JSON.stringify(synonyms)}`);

      console.log("Chạy được tới bước 3")
      // --- STEP 4: Detect Gesture Code ---
      // Input: Array Synonyms -> Output: Complex JSON Array (Frame, timestamp, bones...)
      const gestureEndpoint = `${this.SYNONISM_URL}/detectGestureCode/get`;
      this.logger.log(`Step 4: Generating gesture codes...`);

      const gestureRes = await firstValueFrom(
        this.httpService.post(
          gestureEndpoint,
          { words: synonyms }, // Payload gửi đi
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 600000, // Timeout dài cho xử lý nặng
          }
        )
      );
      
      const gestureCodes = gestureRes.data;

      // --- STEP 5: Save to Database (Cache) ---
      if (urlMedia && gestureCodes) {
        this.logger.log("Saving result to database...");
        const newRecord = new this.signLanguage({
          urlMedia: urlMedia,
          signLanguage: gestureCodes, // Lưu mảng JSON phức tạp vào field này
          createdAt: new Date()
        });
        await newRecord.save();
      }

      // Return final result
      return {
        cached: false,
        urlMedia: urlMedia,
        signLanguage: gestureCodes
      };

    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error instanceof AxiosError) {
      this.logger.error(`External API Error: ${error.message}`);
      this.logger.error('Response data:', error.response?.data);
      this.logger.error('Request url:', error.config?.url);

      throw new HttpException(
        error.response?.data?.error || error.response?.data || 'Lỗi từ phía AI Server',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    
    this.logger.error('Internal Server Error', error);
    throw new HttpException(error.message || 'Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}