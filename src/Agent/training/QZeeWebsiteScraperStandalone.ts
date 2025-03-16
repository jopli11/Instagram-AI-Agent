import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Function to scrape website content
async function scrapeWebsite(url: string): Promise<string> {
  try {
    console.log(`Scraping website: ${url}`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Remove script tags, style tags, and other non-content elements
    $("script").remove();
    $("style").remove();
    $("nav").remove();
    $("footer").remove();
    
    // Extract text content
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    console.log(`Successfully scraped ${bodyText.length} characters of content`);
    return bodyText;
  } catch (error) {
    console.error(`Error scraping website ${url}:`, error);
    return "";
  }
}

// Function to save scraped content to a file
function saveToFile(content: string, filename: string): void {
  try {
    // Create directory path
    const dirPath = path.join(__dirname, "sample");
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, content);
    console.log(`Content saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving content to file:`, error);
  }
}

// Function to train the model with website content
async function trainWithWebsiteContent(content: string): Promise<void> {
  try {
    // Use the Gemini API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY_1;
    if (!apiKey) {
      console.error("No Gemini API key available. Please set GEMINI_API_KEY_1 in your .env file.");
      return;
    }
    
    console.log("Processing content with Gemini API...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Create a prompt to extract key information from the website content
    const prompt = `
    The following text was scraped from the QZee website. 
    QZee is a smart booking solution designed to help businesses manage appointments and reservations.
    
    Please analyze this content and extract the most important information about QZee's services, features, and value proposition.
    Format the output as structured markdown that can be used for training an AI agent to represent QZee on social media.
    
    Website content:
    ${content}
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log("Successfully processed content with Gemini API");
    
    // Save the processed content
    saveToFile(response, "QZee_website_processed.md");
    
  } catch (error) {
    console.error("Error training with website content:", error);
  }
}

// Main function to execute the scraping and training process
async function main(): Promise<void> {
  try {
    const websiteUrl = "https://www.qzee.app/";
    
    const content = await scrapeWebsite(websiteUrl);
    if (content) {
      console.log("Website content scraped successfully");
      
      // Save raw content
      saveToFile(content, "QZee_website_raw.txt");
      
      // Process and train with the content
      await trainWithWebsiteContent(content);
      console.log("Website scraping and processing completed successfully");
    } else {
      console.error("Failed to scrape website content");
    }
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Execute the main function
main().catch(console.error); 