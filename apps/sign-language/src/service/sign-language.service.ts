import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SignLanguage } from 'apps/sign-language/core/sign_language.schema';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { text } from 'express';

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  private SYNONISM_URL = process.env.SYNNONISM_URL;
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(SignLanguage.name, "signLanguageConnection") private signLanguage: Model<SignLanguage>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy
  ) { }

  private parseSRTContent(srtContent: string): string {
    const lines = srtContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines, sequence numbers, and timestamp lines
      if (!line ||
        /^\d+$/.test(line) ||
        /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(line)) {
        continue;
      }

      // This is subtitle text
      textLines.push(line);
    }

    return textLines.join(' ').trim();
  }

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
          signLanguage: existed.signLanguage
        };
      }
    }

    try {
      // --- STEP 1: Get Subtitle ---
      this.logger.log(`Step 1: Fetching subtitle from phowhisper`);

      const subtitleRes = await firstValueFrom(
        this.phowhisperClient.send(
          "subtitle.getSubtitle",
          { videoUrl: urlMedia }
        )
      );

      console.log("subtitleRes", subtitleRes);

      // Kiểm tra xem có subtitleUrl không
      if (!subtitleRes?.subtitleUrl) {
        throw new Error("No subtitle URL returned from phowhisper");
      }

      // Tải nội dung file SRT từ subtitleUrl
      //this.logger.log(`Downloading SRT file from: ${subtitleRes.subtitleUrl}`);
      const srtResponse = await firstValueFrom(
        this.httpService.get(subtitleRes.subtitleUrl, {
          responseType: 'text'
        })
      );

      const srtContent = srtResponse.data;
      //this.logger.debug(`SRT Content received: ${srtContent.substring(0, 200)}...`);

      // Parse nội dung SRT để lấy text
      const subtitleText = this.parseSRTContent(srtContent);

      if (!subtitleText) throw new Error("Subtitle extraction failed - no text found");
      this.logger.debug(`Subtitle text extracted: ${subtitleText}`);
      console.log("Step 1 completed - Subtitle text:", subtitleText);

      // --- STEP 2: Tokenize (Underthesea) ---
      this.logger.log(`Step 2: Tokenizing text...`);

      const postagRes = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: subtitleText })
      );

      console.log("postagRes ", postagRes);

      // Response structure: { pos_tags: [...], success: true, tokens: [...] }
      if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
        throw new Error("POSTag failed or returned invalid response");
      }

      // Lọc tokens dựa trên pos_tags
      // Các POS tag cần giữ lại: N (noun), Np (proper noun), V (verb), A (adjective), R (adverb), M (numeral), Nc (classifier noun)
      const validPosTags = ['N', 'Np', 'V', 'A', 'R', 'M', 'Nc'];

      const tokens = postagRes.pos_tags
        .filter(([word, tag]) => validPosTags.includes(tag))
        .map(([word, tag]) => word);

      this.logger.debug(`Tokens: ${tokens.join(', ')}`);
      console.log("Step 2 completed - Tokens:", tokens);

      // --- STEP 3: Get Synonyms ---
      const synonymEndpoint = `${this.SYNONISM_URL}/search`;
      this.logger.log(`Step 3: Getting synonyms...`);

      const synonymRes = await firstValueFrom(
        this.httpService.post(synonymEndpoint, { query: tokens, max_results_per_query: 1 })
      );

      const synonymsData = synonymRes.data;
      this.logger.debug(`Synonyms response: ${JSON.stringify(synonymsData)}`);


      // --- STEP 4: Detect Gesture Code ---
      // const gestureEndpoint = `${this.SYNONISM_URL}/detectGestureCode/get`;
      // this.logger.log(`Step 4: Generating gesture codes...`);

      // const gestureRes = await firstValueFrom(
      //   this.httpService.post(
      //     gestureEndpoint,
      //     { words: synonyms },
      //     {
      //       headers: { 'Content-Type': 'application/json' },
      //       timeout: 600000,
      //     }
      //   )
      // );

      // const gestureCodes = gestureRes.data;

      // // --- STEP 5: Save to Database (Cache) ---
      // if (urlMedia && gestureCodes) {
      //   this.logger.log("Saving result to database...");
      //   const newRecord = new this.signLanguage({
      //     urlMedia: urlMedia,
      //     signLanguage: gestureCodes,
      //     createdAt: new Date()
      //   });
      //   await newRecord.save();
      // }

      // Return final result
      return {
        cached: false,
        urlMedia: urlMedia,
        //signLanguage: gestureCodes
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