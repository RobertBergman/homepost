const axios = require('axios');

describe("OpenAI API Environment Test", () => {
  it("should return an unauthorized error when using a fake API key", async () => {
    // Set the fake API key in process.env
    process.env.OPENAI_API_KEY = "fake-key";
    try {
      // Call a simple GET endpoint that requires authentication.
      // The models endpoint is public but requires a valid API key.
      await axios.get("https://api.openai.com/v1/models", {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });
      // If the request unexpectedly succeeds, fail the test.
      throw new Error("Request succeeded unexpectedly with fake API key");
    } catch (error) {
      // Expect a 401 Unauthorized error from OpenAI.
      expect(error.response.status).toBe(401);
      // The error message should indicate an invalid or incorrect API key.
      expect(error.response.data.error.message.toLowerCase()).toMatch(/invalid|incorrect/);
    }
  });
});
