# QZee Instagram Bot Setup Guide

This guide provides step-by-step instructions for setting up and running the QZee Instagram Bot, which is customized to engage with relevant industry accounts and hashtags to build QZee's following as a smart booking solution.

## 1. Prerequisites

Before running the bot, ensure you have:

- Node.js (v14 or higher) installed
- A valid Instagram account for QZee (@qzee.app)
- Gemini API key(s) for AI functionality (from Google AI Studio)
- Git installed (for cloning the repository)

## 2. Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/your-username/Instagram-AI-Agent.git
   cd Instagram-AI-Agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create necessary directories:
   ```bash
   mkdir -p cookies
   ```

## 3. Configuration

### Environment Variables

1. Edit the `.env` file with your credentials:
   ```
   # Instagram Credentials
   IGusername=your_instagram_username
   IGpassword=your_instagram_password
   
   # Gemini API Keys (for AI functionality)
   GEMINI_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2
   
   # Bot Configuration
   MAX_POSTS_PER_SESSION=15
   MIN_WAIT_BETWEEN_POSTS=15000
   MAX_WAIT_BETWEEN_POSTS=45000
   MIN_WAIT_BETWEEN_SESSIONS=180000
   MAX_WAIT_BETWEEN_SESSIONS=600000
   LIKE_PROBABILITY=0.7
   COMMENT_PROBABILITY=0.4
   ```

### Character Selection

The bot is pre-configured with a QZee character profile in `src/Agent/characters/QZee.character.json`. This profile defines how the bot will interact with posts and users on Instagram.

## 4. Training the Bot

The bot uses training data to improve its responses. We've included:

1. **Basic QZee Information**: Located in `src/Agent/training/sample/QZee_info.txt`

2. **Website Scraping**: You can run the website scraper to gather additional training data:
   ```bash
   npx ts-node src/Agent/training/QZeeWebsiteScraping.ts
   ```

3. **Custom Training**: You can add additional training materials to `src/Agent/training/sample/` such as:
   - PDF documents about booking systems
   - Text files with industry insights
   - Audio files with conversational examples

## 5. Running the Bot

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the bot:
   ```bash
   npm start
   ```

3. On first run, the bot will:
   - Prompt you to select a character (choose "QZee Smart Booking")
   - Open a browser window and log in to Instagram
   - Save cookies for future sessions
   - Begin interacting with relevant hashtags and accounts

## 6. Bot Behavior

The QZee Instagram bot is configured to:

- Alternate between exploring industry hashtags and competitor accounts
- Like approximately 70% of posts it encounters
- Comment on approximately 40% of posts with relevant, helpful insights
- Wait between 15-45 seconds between post interactions
- Wait 3-10 minutes between exploration sessions
- Limit interactions to 15 posts per session to avoid detection

## 7. Customization Options

You can customize the bot's behavior by:

1. **Modifying Hashtags and Accounts**: Edit the arrays in `src/client/Instagram.ts`:
   - `relevantHashtags`: Industry-specific hashtags to explore
   - `relevantAccounts`: Competitor or industry accounts to monitor

2. **Adjusting Interaction Parameters**: Edit values in the `.env` file:
   - `LIKE_PROBABILITY`: Chance of liking a post (0.0-1.0)
   - `COMMENT_PROBABILITY`: Chance of commenting on a post (0.0-1.0)
   - `MAX_POSTS_PER_SESSION`: Maximum posts to interact with per session

3. **Enhancing the Character**: Edit `src/Agent/characters/QZee.character.json` to refine:
   - Knowledge about QZee
   - Example messages and posts
   - Communication style and topics

## 8. Monitoring and Maintenance

- Check the console logs for information about the bot's activities
- Review `logged_in.png` to verify successful login
- Periodically update training data to keep responses fresh and relevant
- Monitor Instagram's terms of service for any changes that might affect bot usage

## 9. Safety Considerations

- The bot includes random delays and probabilistic interactions to mimic human behavior
- It limits the number of interactions per session to reduce detection risk
- Always use the bot responsibly and in accordance with Instagram's terms of service

## 10. Troubleshooting

- **Login Issues**: Delete the `cookies/Instagramcookies.json` file and restart the bot
- **API Key Errors**: Verify your Gemini API keys in the `.env` file
- **Selector Errors**: Instagram may change its HTML structure; check the console for errors and update selectors in `src/client/Instagram.ts` if needed

## Support

For questions or issues, please contact the development team or create an issue in the repository.

---

**Note**: This bot is designed for educational purposes and to assist with legitimate business social media engagement. Use responsibly and in accordance with Instagram's terms of service. 