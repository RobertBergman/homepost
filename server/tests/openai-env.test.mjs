import dotenv from 'dotenv';
dotenv.config();
import { Configuration, OpenAIApi } from 'openai';

describe('OpenAI API Configuration Test', () => {
  it('uses the API key from .env and returns an invalid key error when provided a fake key', async () => {
    process.env.OPENAI_API_KEY = 'sk-fakeapikey';

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openaiApi = new OpenAIApi(configuration);

    await expect(openaiApi.listModels()).rejects.toThrow(/invalid/i);
  });
});
