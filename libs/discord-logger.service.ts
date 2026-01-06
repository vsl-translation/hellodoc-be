import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscordLoggerService {
    constructor(private configService: ConfigService) {}

    private getVietnamTime(): string {
        return new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date());
    }

    async sendSuccess(message: string, context?: string) {
        const content = 
`\`\`\`
✅ SUCCESS${context ? ` [${context}]` : ''}
📃 ${message}
🕒 ${this.getVietnamTime()}
\`\`\``;

        await this.sendLog(content);
    }

    async sendError(error: any, context?: string) {
        const errorMessage = error?.message || JSON.stringify(error, null, 2);
        const content =
`\`\`\`
❌ FAILED${context ? ` [${context}]` : ''}
📃 ${errorMessage}
🕒 ${this.getVietnamTime()}
\`\`\``;

        await this.sendLog(content);
    }

    private async sendLog(content: string) {
        try {
            const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
            if (!webhookUrl) {
                console.warn('DISCORD_WEBHOOK_URL is not defined');
                return;
            }
            await axios.post(webhookUrl, { content });
        } catch (err) {
            console.error('Discord Log Error:', err.message);
        }
    }
}
