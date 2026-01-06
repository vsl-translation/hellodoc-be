import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { Word } from 'apps/sign-language/core/schema/word.schema';
import { Video } from 'apps/sign-language/core/schema/sign_language.schema';

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  private SYNONISM_URL = "https://demoded-lourie-unpoulticed.ngrok-free.dev";
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;
  private DETECT_URL = "https://cherise-unrebated-silly.ngrok-free.dev";

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Word.name, "signLanguageConnection") private wordModel: Model<Word>,
    @InjectModel(Video.name, "signLanguageConnection") private videoModel: Model<Video>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy,
    @Inject("CLOUDINARY_CLIENT") private cloudinaryService: ClientProxy,
  ) { }

  private parseSRTContent(srtContent: string): string {
    const lines = srtContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line ||
        /^\d+$/.test(line) ||
        /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(line)) {
        continue;
      }

      textLines.push(line);
    }

    return textLines.join(' ').trim();
  }

  async getGestureCode(videoUrl: string) {
    this.logger.log(`Processing gesture code for video URL: ${videoUrl}`);
    const startTime = Date.now();

    // 1. Kiểm tra cache trong Video collection
    const cachedVideo = await this.videoModel.findOne({ videoUrl }).populate('wordCodes');

    if (cachedVideo && cachedVideo.wordCodes.length > 0) {
      this.logger.log("Found cached data for video");
      const wordCodes = await Promise.all(
        cachedVideo.wordCodes.map(async (wordId) => {
          const word = await this.wordModel.findById(wordId);
          return {
            word: word?.word,
            code: word?.code,
            originalVideoUrl: word?.originalVideoUrl,
            accuracy: word?.accuracy,
            gross: word?.gross
          };
        })
      );

      return {
        cached: true,
        videoUrl: cachedVideo.videoUrl,
        subtitleText: cachedVideo.subtitleText,
        processedWords: cachedVideo.processedWords,
        wordCodes: wordCodes,
        totalProcessingTime: cachedVideo.totalProcessingTime
      };
    }

    try {
      // --- STEP 1: Get Subtitle ---
      this.logger.log(`Step 1: Fetching subtitle from phowhisper`);
      const subtitleRes = await firstValueFrom(
        this.phowhisperClient.send(
          "subtitle.getSubtitle",
          { videoUrl }
        )
      );

      if (!subtitleRes?.subtitleUrl) {
        throw new Error("No subtitle URL returned from phowhisper");
      }

      const srtResponse = await firstValueFrom(
        this.httpService.get(subtitleRes.subtitleUrl, {
          responseType: 'text'
        })
      );

      const srtContent = srtResponse.data;
      const subtitleText = this.parseSRTContent(srtContent);

      if (!subtitleText) throw new Error("Subtitle extraction failed - no text found");
      this.logger.debug(`Subtitle text extracted: ${subtitleText}`);

      // --- STEP 2: Tokenize (Underthesea) ---
      this.logger.log(`Step 2: Tokenizing text...`);
      const postagRes = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: subtitleText })
      );

      if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
        throw new Error("POSTag failed or returned invalid response");
      }

      const validPosTags = ['N', 'Np', 'V', 'A', 'R', 'M', 'Nc'];
      const tokens = postagRes.pos_tags
        .filter(([word, tag]) => validPosTags.includes(tag))
        .map(([word, tag]) => word.trim());

      this.logger.debug(`Tokens: ${tokens.join(', ')}`);

      // --- STEP 3: Get Synonyms (FIXED - Call API individually) ---
      const synonymEndpoint = `${this.SYNONISM_URL}/search`;
      this.logger.log(`Step 3: Getting synonyms for ${tokens.length} words...`);

      const synonymMap: Map<string, any[]> = new Map();
      const BATCH_SIZE = 3; // Process 3 words at a time to avoid overwhelming the API

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        this.logger.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tokens.length / BATCH_SIZE)}`);

        // Call API for each token in parallel within batch
        const batchPromises = batch.map(async (token) => {
          try {
            this.logger.debug(`Fetching synonyms for: "${token}"`);

            const synonymRes = await firstValueFrom(
              this.httpService.post(synonymEndpoint, {
                query: token, // ✅ Send STRING, not ARRAY
                max_results_per_query: 3 // ✅ Get top 3 results
              })
            );

            const results = synonymRes.data?.results;

            if (results && Array.isArray(results) && results.length > 0) {
              this.logger.debug(`Found ${results.length} synonyms for "${token}"`);
              return { token, data: results };
            } else {
              this.logger.warn(`No synonyms found for "${token}"`);
              return { token, data: [] };
            }
          } catch (error) {
            this.logger.error(`Error fetching synonyms for "${token}": ${error.message}`);
            return { token, data: [], error: error.message };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Store results in map
        batchResults.forEach(({ token, data }) => {
          synonymMap.set(token, data || []);
        });

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      this.logger.log(`Synonym map created with ${synonymMap.size} entries`);

      // --- STEP 4: Process Each Word ---
      this.logger.log(`Step 4: Processing words through Google Colab API...`);

      const wordObjectIds: Types.ObjectId[] = [];
      const processedWordsInfo: any[] = [];
      const skippedWords: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        try {
          console.log(`\n=== PROCESSING WORD ${i + 1}/${tokens.length}: "${token}" ===`);

          // Kiểm tra nếu từ đã tồn tại trong database
          let existingWord = await this.wordModel.findOne({ word: token });

          if (existingWord) {
            console.log(`✅ Found in cache: "${token}"`);

            existingWord.usageCount += 1;
            await existingWord.save();
            wordObjectIds.push(existingWord._id as Types.ObjectId);

            processedWordsInfo.push({
              word: token,
              code: existingWord.code,
              cached: true,
              accuracy: existingWord.accuracy,
              gross: existingWord.gross
            });

            this.logger.log(`Word "${token}" found in cache, reusing existing data`);
            continue;
          }

          console.log(`📝 Not in cache, need to process: "${token}"`);

          // ✅ Get synonym data from map
          const synonymArray = synonymMap.get(token) || [];

          console.log(`Synonym data found: ${synonymArray.length} results`);

          if (synonymArray.length === 0) {
            this.logger.warn(`⚠️ Skipping word "${token}" - no synonym data found`);
            skippedWords.push(token);
            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'No synonym data found'
            });
            continue;
          }

          // Log all available synonyms with their accuracy
          console.log(`Available synonyms for "${token}":`);
          synonymArray.forEach((syn, idx) => {
            console.log(`  ${idx + 1}. ${syn.gross || 'N/A'} - Accuracy: ${syn.accuracy}%`);
          });

          // Process word with synonym array (will select best match inside)
          const wordData = await this.processSingleWord(token, synonymArray);

          if (wordData?.code) {
            console.log(`💾 Saving word "${token}" to database...`);

            const newWord = new this.wordModel({
              word: token,
              code: wordData.code,
              originalVideoUrl: wordData.originalVideoUrl,
              accuracy: wordData.accuracy,
              gross: wordData.gross,
              tags: ['auto-generated'],
              usageCount: 1
            });

            const savedWord = await newWord.save();
            wordObjectIds.push(savedWord._id as Types.ObjectId);

            processedWordsInfo.push({
              word: token,
              code: wordData.code,
              cached: false,
              accuracy: wordData.accuracy,
              gross: wordData.gross
            });

            this.logger.log(`✅ Successfully processed and saved word: "${token}"`);
          } else {
            this.logger.warn(`⚠️ No code returned for word "${token}"`);
            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'Processing failed - no code returned'
            });
          }

        } catch (wordError) {
          this.logger.error(`❌ Error processing word "${token}": ${wordError.message}`);
          processedWordsInfo.push({
            word: token,
            code: null,
            cached: false,
            skipped: true,
            reason: wordError.message
          });
        }
      }

      // --- STEP 5: Save video info ---
      const processingTime = Date.now() - startTime;

      console.log('\n=== PROCESSING SUMMARY ===');
      console.log('Total tokens:', tokens.length);
      console.log('Successfully processed:', processedWordsInfo.filter(w => !w.skipped).length);
      console.log('Skipped words:', skippedWords.length);
      if (skippedWords.length > 0) {
        console.log('Skipped word list:', skippedWords.join(', '));
      }
      console.log('Total processing time:', processingTime, 'ms');

      let videoRecord = await this.videoModel.findOne({ videoUrl });

      if (videoRecord) {
        videoRecord.wordCodes = wordObjectIds;
        videoRecord.processedWords = tokens;
        videoRecord.subtitleText = subtitleText;
        videoRecord.totalProcessingTime = processingTime;
        await videoRecord.save();
        this.logger.log('Updated existing video record');
      } else {
        videoRecord = new this.videoModel({
          videoUrl: videoUrl,
          wordCodes: wordObjectIds,
          processedWords: tokens,
          subtitleText: subtitleText,
          totalProcessingTime: processingTime
        });
        await videoRecord.save();
        this.logger.log('Created new video record');
      }

      return {
        cached: false,
        videoUrl: videoUrl,
        subtitleText: subtitleText,
        processedWords: tokens,
        wordCodes: processedWordsInfo,
        skippedWords: skippedWords,
        totalProcessingTime: processingTime,
        stats: {
          total: tokens.length,
          processed: processedWordsInfo.filter(w => !w.skipped).length,
          cached: processedWordsInfo.filter(w => w.cached).length,
          skipped: skippedWords.length
        }
      };

    } catch (error) {
      this.handleError(error);
    }
  }

  private async processSingleWord(word: string, synonymData: any[]): Promise<any> {
    if (!synonymData || !Array.isArray(synonymData) || synonymData.length === 0) {
      throw new Error(`No synonym data found for word: ${word}`);
    }

    // ✅ Sort by accuracy descending and select best match
    const sortedSynonyms = [...synonymData].sort((a, b) => {
      const accA = parseFloat(a.accuracy) || 0;
      const accB = parseFloat(b.accuracy) || 0;
      return accB - accA;
    });

    const bestMatch = sortedSynonyms[0];
    const videoUrl = bestMatch.url;
    const accuracy = bestMatch.accuracy;
    const gross = bestMatch.gross;

    this.logger.log(`Processing word: "${word}"`);
    this.logger.log(`  ✅ Selected best match: "${gross}" (Accuracy: ${accuracy}%)`);
    this.logger.log(`  📹 Video URL: ${videoUrl}`);

    try {
      const colabApiUrl = this.DETECT_URL;
      const jobResponse = await firstValueFrom(
        this.httpService.post(
          `${colabApiUrl}/api/detect`,
          {
            video_url: videoUrl,
            frames_per_minute: 1
          },
          { timeout: 300000 }
        )
      );

      const jobId = jobResponse.data.job_id;
      this.logger.log(`Job created: ${jobId} for word: ${word}`);

      const gestureData = await this.pollForJobCompletion(colabApiUrl, jobId, word);

      if (!gestureData) {
        throw new Error(`Failed to get gesture data for word: ${word}`);
      }

      const cloudinaryUrl = await this.uploadGestureToCloudinary(word, gestureData);

      return {
        word: word,
        code: cloudinaryUrl,
        originalVideoUrl: videoUrl,
        accuracy: accuracy,
        gross: gross,
        gestureData: gestureData
      };

    } catch (error) {
      this.logger.error(`Error processing word "${word}": ${error.message}`);
      throw error;
    }
  }

  private async pollForJobCompletion(colabApiUrl: string, jobId: string, word: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const statusResponse = await firstValueFrom(
          this.httpService.get(`${colabApiUrl}/api/job/${jobId}`)
        );

        const jobStatus = statusResponse.data;

        if (jobStatus.status === 'completed') {
          this.logger.log(`Job ${jobId} completed for word: ${word}`);

          const downloadResponse = await firstValueFrom(
            this.httpService.get(`${colabApiUrl}/api/job/${jobId}/download`, {
              responseType: 'json'
            })
          );

          return downloadResponse.data;

        } else if (jobStatus.status === 'failed') {
          throw new Error(`Job failed: ${jobStatus.message}`);
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout waiting for job completion');
        }
      }
    }

    throw new Error('Max polling attempts reached');
  }

  private async uploadGestureToCloudinary(word: string, gestureData: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(gestureData, null, 2);

      const uploadResponse = await firstValueFrom(
        this.cloudinaryService.send(
          'cloudinary.upload-json',
          {
            jsonData: jsonString,
            publicId: `gesture_${word}_${Date.now()}`,
            folder: 'sign-language/gestures',
            tags: ['sign-language', 'gesture', word],
            resource_type: 'raw'
          }
        )
      );

      return uploadResponse.secure_url || uploadResponse.url;

    } catch (error) {
      this.logger.error(`Error uploading to Cloudinary for word "${word}": ${error.message}`);
      throw error;
    }
  }

  async getWordByWord(word: string) {
    return await this.wordModel.findOne({ word });
  }

  async getVideoByUrl(videoUrl: string) {
    return await this.videoModel.findOne({ videoUrl }).populate('wordCodes');
  }

  async getAllWords(skip = 0, limit = 50) {
    return await this.wordModel.find()
      .sort({ usageCount: -1, word: 1 })
      .skip(skip)
      .limit(limit);
  }

  async getAllVideos(skip = 0, limit = 20) {
    return await this.videoModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('wordCodes');
  }

  async updateWordCode(word: string, newCode: string) {
    return await this.wordModel.findOneAndUpdate(
      { word },
      { code: newCode, $inc: { usageCount: 1 } },
      { new: true }
    );
  }

  async searchWords(query: string) {
    return await this.wordModel.find({
      word: { $regex: query, $options: 'i' }
    }).limit(20);
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