import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateSpecialtyDto } from "../core/dto/create-specialty.dto";
import { UpdateSpecialtyDto } from "../core/dto/update-specialty.dto";
import { lastValueFrom } from "rxjs";

@Injectable()
export class SpecialtyService {
    constructor(
        @Inject('SPECIALTY_CLIENT') private specialtyClient: ClientProxy
    ) { }

    async getSpecialties() {
        return this.specialtyClient.send('specialty.get-all', {})
    }

    async getAllWithFilter(limit?: string, offset?: string, searchText?: string) {
        return lastValueFrom(this.specialtyClient.send('specialty.get-all-filtered', {
            limit: limit ? parseInt(limit) : 10,
            offset: offset ? parseInt(offset) : 0,
            searchText
        }));
    }

    async create(createSpecialtyDto: CreateSpecialtyDto) {
        return this.specialtyClient.send('specialty.create', createSpecialtyDto)
    }

    async update(id: string, updateSpecialty: UpdateSpecialtyDto) {
        return this.specialtyClient.send('specialty.update', { id, updateSpecialty })
    }

    async remove(id: string) {
        return this.specialtyClient.send('specialty.remove', id)
    }

    async getSpecialtyById(id: string) {
        return this.specialtyClient.send('specialty.get-by-id', id)
    }

    async getSpecialtyByName(name: string) {
        return lastValueFrom(
            this.specialtyClient.send('specialty.get-by-name', name)
        );
    }

    async analyzeSpecialty(text: string, specialties?: string[]) {
        return lastValueFrom(
            this.specialtyClient.send('specialty.analyze', { text, specialties })
        );
    }
}
