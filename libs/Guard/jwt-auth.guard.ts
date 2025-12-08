import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtHybridAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const contextType = context.getType();
        let token: string;
        let target: any;

        if (contextType === 'http') {
            // HTTP Context (REST API từ client)
            const request = context.switchToHttp().getRequest<Request>();
            token = request.headers['accesstoken'] as string;
            target = request;
        } else if (contextType === 'rpc') {
            // RPC Context (Microservice communication)
            const rpcContext = context.switchToRpc();
            const data = rpcContext.getData();
            token = data?.accesstoken || data?.token;
            target = data;
        } else {
            throw new UnauthorizedException('Unsupported context type');
        }

        if (!token) {
            throw new UnauthorizedException('Bạn chưa đăng nhập');
        }

        try {
            const decoded = this.jwtService.verify(token);
            target.user = decoded;
            return true;
        } catch (error) {
            throw new UnauthorizedException('Token không hợp lệ');
        }
    }
}