import { Test, TestingModule } from '@nestjs/testing';
import { SignLanguageController } from './sign-language.controller';
import { SignLanguageService } from './sign-language.service';

describe('SignLanguageController', () => {
  let signLanguageController: SignLanguageController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SignLanguageController],
      providers: [SignLanguageService],
    }).compile();

    signLanguageController = app.get<SignLanguageController>(SignLanguageController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(signLanguageController.getHello()).toBe('Hello World!');
    });
  });
});
