import { IsString, IsNotEmpty } from 'class-validator';

export class GetSpecialtyByNameDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}
