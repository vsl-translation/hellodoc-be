import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const contextType = context.getType();
        let user: any;

        if (contextType === 'http') {
            // HTTP Context (REST API)
            const request = context.switchToHttp().getRequest();
            user = request.user;
        } else if (contextType === 'rpc') {
            // RPC Context (Microservices)
            const data = context.switchToRpc().getData();
            user = data.user;

            // DEBUG LOG 
            // console.log('AdminGuard RPC Debug:');
            // console.log('   Full data:', JSON.stringify(data, null, 2));
            // console.log('   User from data.user:', user);
            // console.log('   User role:', user?.role);
        } else {
            throw new ForbiddenException('Unsupported context type');
        }

        if (!user) {
            console.log('User object not found in request/data');
            throw new ForbiddenException('Không tìm thấy thông tin người dùng');
        }

        const userRole = user.role?.toString().toLowerCase();
        const isAdmin = userRole === 'admin';

        console.log(`   ➜ Checking role: "${user.role}" → is admin: ${isAdmin}`);

        if (!isAdmin) {
            throw new ForbiddenException(
                `Chỉ admin mới có quyền truy cập. Role hiện tại: "${user.role}"`
            );
        }

        return true;
    }
}