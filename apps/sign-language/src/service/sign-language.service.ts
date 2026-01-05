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
  private DETECT_URL = process.env.DETECT_URL;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(SignLanguage.name, "signLanguageConnection") private signLanguage: Model<SignLanguage>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy,
    @Inject("CLOUDINARY_CLIENT") private cloudinaryService: ClientProxy,
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
      this.logger.log(`Step 4: Processing videos through Google Colab API...`);

      const results = await this.processSynonymsThroughColabAPI(synonymsData);
      console.log("Step 4 completed - Colab results:", results);


      // --- STEP 5: Upload to Cloudinary and Save to Database ---
      this.logger.log(`Step 5: Uploading results to Cloudinary and saving to DB...`);

      const cloudinaryResults = await this.uploadResultsToCloudinary(results);
      console.log("Step 5 completed - Cloudinary URLs:", cloudinaryResults);

      // --- Save to Database (Cache) ---
      if (urlMedia && cloudinaryResults) {
        this.logger.log("Saving result to database...");
        const newRecord = new this.signLanguage({
          urlMedia: urlMedia,
          signLanguage: cloudinaryResults,
          createdAt: new Date()
        });
        await newRecord.save();
      }

      // Return final result
      return {
        cached: false,
        urlMedia: urlMedia,
        signLanguage: cloudinaryResults
      };


    } catch (error) {
      this.handleError(error);
    }
  }

  private async processSynonymsThroughColabAPI(synonymsData: any): Promise<any[]> {
    const results = [];
    const colabApiUrl = this.DETECT_URL; // Thay bằng URL Google Colab của bạn

    // Lặp qua tất cả các từ trong synonyms
    for (const [word, data] of Object.entries(synonymsData.results)) {
      if (Array.isArray(data) && data.length > 0 && data[0].url) {
        const videoUrl = data[0].url;
        const accuracy = data[0].accuracy;
        const gross = data[0].gross;

        this.logger.log(`Processing word: "${word}" - URL: ${videoUrl}`);

        try {
          // Gửi yêu cầu đến API Google Colab
          const jobResponse = await firstValueFrom(
            this.httpService.post(
              `${colabApiUrl}/api/detect`,
              {
                video_url: videoUrl,
                frames_per_minute: 1
              },
              {
                timeout: 300000 // 5 phút timeout
              }
            )
          );

          const jobId = jobResponse.data.job_id;
          this.logger.log(`Job created: ${jobId} for word: ${word}`);

          // Chờ job hoàn thành (polling)
          let jobStatus = null;
          let attempts = 0;
          const maxAttempts = 60; // Tối đa 5 phút (60 * 5 giây)

          while (attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Chờ 5 giây

            try {
              const statusResponse = await firstValueFrom(
                this.httpService.get(`${colabApiUrl}/api/job/${jobId}`)
              );

              jobStatus = statusResponse.data;

              if (jobStatus.status === 'completed') {
                this.logger.log(`Job ${jobId} completed for word: ${word}`);

                // Tải kết quả JSON
                const downloadResponse = await firstValueFrom(
                  this.httpService.get(`${colabApiUrl}/api/job/${jobId}/download`, {
                    responseType: 'json'
                  })
                );

                results.push({
                  word: word,
                  original_video_url: videoUrl,
                  accuracy: accuracy,
                  gross: gross,
                  job_id: jobId,
                  gesture_data: downloadResponse.data,
                  processed_at: new Date()
                });

                break;
              } else if (jobStatus.status === 'failed') {
                this.logger.error(`Job ${jobId} failed for word: ${word}`);
                results.push({
                  word: word,
                  original_video_url: videoUrl,
                  accuracy: accuracy,
                  gross: gross,
                  error: `Job failed: ${jobStatus.message}`,
                  processed_at: new Date()
                });
                break;
              }
            } catch (error) {
              this.logger.error(`Error checking job status: ${error.message}`);
              if (attempts >= maxAttempts) {
                results.push({
                  word: word,
                  original_video_url: videoUrl,
                  accuracy: accuracy,
                  gross: gross,
                  error: 'Timeout waiting for job completion',
                  processed_at: new Date()
                });
                break;
              }
            }
          }

        } catch (error) {
          this.logger.error(`Error processing word "${word}": ${error.message}`);
          results.push({
            word: word,
            original_video_url: videoUrl,
            accuracy: accuracy,
            gross: gross,
            error: error.message,
            processed_at: new Date()
          });
        }

        // Thêm delay giữa các request để tránh quá tải API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        this.logger.warn(`No video URL found for word: "${word}"`);
        results.push({
          word: word,
          original_video_url: null,
          accuracy: null,
          gross: null,
          error: 'No video URL available',
          processed_at: new Date()
        });
      }
    }

    return results;
  }

  private async uploadResultsToCloudinary(results: any[]): Promise<any[]> {
    const cloudinaryResults = [];

    for (const result of results) {
      if (result.error || !result.gesture_data) {
        cloudinaryResults.push({
          word: result.word,
          error: result.error || 'No gesture data available',
          cloudinary_url: null
        });
        continue;
      }

      try {
        // 1. Convert gesture data to JSON string
        const jsonString = JSON.stringify(result.gesture_data, null, 2);

        // 2. Upload JSON to Cloudinary
        const uploadResponse = await firstValueFrom(this.cloudinaryService.send(
          'cloudinary.upload-json',
          {
            jsonData: jsonString,
            publicId: `gesture_${result.word}_${Date.now()}`,
            folder: 'sign-language/gestures',
            tags: ['sign-language', 'gesture'],
            resource_type: 'raw'
          }
        ));


        // 3. Tải và upload hình ảnh skeleton frames nếu có
        const imageUrls = [];
        if (Array.isArray(result.gesture_data) && result.gesture_data.length > 0) {
          for (const frame of result.gesture_data.slice(0, 3)) { // Lấy 3 frame đầu tiên
            if (frame.skeleton_image) {
              try {
                // Tải hình ảnh từ server Colab
                const imageBuffer = await this.downloadImage(frame.skeleton_image);

                // Upload lên Cloudinary
                const imageUpload = await firstValueFrom(this.cloudinaryService.send(
                  'cloudinary.upload-gesture-image',
                  {
                    buffer: imageBuffer,
                    folder: 'sign-language/frames',
                    publicId: `frame_${frame.frame}_${Date.now()}`,
                    tags: ['sign-language', 'frame'],
                    transformation: [
                      { width: 640, height: 480, crop: 'limit' }
                    ]
                  }
                ));

                imageUrls.push(imageUpload);

              } catch (imageError) {
                this.logger.error(`Error uploading image for frame ${frame.frame}: ${imageError.message}`);
              }
            }
          }
        }

        cloudinaryResults.push({
          word: result.word,
          accuracy: result.accuracy,
          gross: result.gross,
          original_video_url: result.original_video_url,
          cloudinary_json_url: uploadResponse,
          cloudinary_json_public_id: uploadResponse,
          sample_frames: imageUrls,
          processed_at: result.processed_at
        });

        this.logger.log(`Uploaded gesture data for "${result.word}" to Cloudinary`);

      } catch (error) {
        this.logger.error(`Error uploading to Cloudinary for word "${result.word}": ${error.message}`);
        cloudinaryResults.push({
          word: result.word,
          error: `Cloudinary upload failed: ${error.message}`,
          cloudinary_url: null
        });
      }
    }

    return cloudinaryResults;
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(imageUrl, {
          responseType: 'arraybuffer'
        })
      );

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
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