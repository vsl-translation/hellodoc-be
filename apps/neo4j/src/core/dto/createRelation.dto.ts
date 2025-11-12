export class CreateRelationDto {
  fromLabel: string;
  fromName: string;
  toLabel: string;
  toName: string;
  relationType: string; // ví dụ: RELATES_TO, SYNONYM_OF, ...
}
