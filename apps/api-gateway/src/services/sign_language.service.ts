import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SignLanguageService{
    private readonly logger = new Logger(SignLanguageService.name)

    constructor(
        @Inject('SIGNLANGUAGE_CLIENT') private readonly signClient: ClientProxy
    ){}

    async getGestureCode(urlMedia:string){
        if (urlMedia){
            throw new BadRequestException('Cần cung cấp url');
        }

        try {
            const result = await firstValueFrom(
                this.signClient.send(
                    'gesture_code.getGestureCode',
                    {
                        urlMedia
                    }
                )
            )
        }
        catch(e){
            console.log("ERROR: ",e)
            
        }
    }
}