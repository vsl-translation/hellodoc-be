import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class UsersService {
    constructor(@Inject('POST_CLIENT') private postClient: ClientProxy) { }

    findAll() {
        return this.postClient.send('post.users', {});
    }
}
