import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { geminiApiKeys } from "../../secret";

// Function to scrape website content
async function scrapeWebsite(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Remove script tags, style tags, and other non-content elements
    $("script").remove();
    $("style").remove();
    $("nav").remove();
    $("footer").remove();
    
    // Extract text content
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    return bodyText;
  } catch (error) {
    console.error(`Error scraping website ${url}:`, error);
    return "";
  }
}

// Function to save scraped content to a file
function saveToFile(content: string, filename: string): void {
  const dirPath = path.join(__dirname, "sample");
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, content);
  console.log(`Content saved to ${filePath}`);
}

// Function to train the model with website content
async function trainWithWebsiteContent(content: string): Promise<void> {
  try {
    // Use the first available API key
    const apiKey = geminiApiKeys[0];
    if (!apiKey) {
      console.error("No Gemini API key available");
      return;
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Create a prompt to extract key information from the website content
    const prompt = `
    The following text was scraped from the QZee website. 
    Please analyze this content and extract the most important information about QZee's services, features, and value proposition.
    Format the output as structured markdown that can be used for training an AI agent to represent QZee on social media.
    
    Website content:
    ${content}
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Save the processed content
    saveToFile(response, "QZee_website_processed.md");
    
  } catch (error) {
    console.error("Error training with website content:", error);
  }
}

// Main function to execute the scraping and training process
async function main(): Promise<void> {
  const websiteUrl = "https://www.qzee.app/";
  console.log(`Scraping website: ${websiteUrl}`);
  
  const content = await scrapeWebsite(websiteUrl);
  if (content) {
    console.log("Website content scraped successfully");
    
    // Save raw content
    saveToFile(content, "QZee_website_raw.txt");
    
    // Process and train with the content
    await trainWithWebsiteContent(content);
  } else {
    console.error("Failed to scrape website content");
  }
}

// Execute the main function
if (require.main === module) {
  main().catch(console.error);
}

export { scrapeWebsite, trainWithWebsiteContent }; 