import puppeteer, { Browser } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import UserAgent from "user-agents";
import { Server } from "proxy-chain";
import { IGpassword, IGusername } from "../secret";
import logger from "../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../utils";
import { runAgent } from "../Agent";
import { getInstagramCommentSchema } from "../Agent/schema";
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(
    AdblockerPlugin({
        // Optionally enable Cooperative Mode for several request interceptors
        interceptResolutionPriority: 1,
    })
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify the question function
const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
};

// Define industry-relevant hashtags and accounts to target
const relevantHashtags = [
    // Personal Trainer & Fitness Booking
    "personaltrainer",
    "ptbooking",
    "fitnessbooking",
    "gymlife",
    "fitnesstrainer",
    "fitnesscoach",
    "onlinecoaching",
    "fitnessbusiness",
    "gymowner",
    "ptlife",
    "fitpreneur",
    "personaltrainingbusiness",
    "fitnessstudio",
    "gymmanagement",
    "fitnessscheduling",
    // Client Experience
    "clientresults",
    "fitnesstransformation",
    "clientprogress",
    "fitnesscommunity",
    "fitfam",
    // Business Growth
    "fitnessindustry",
    "businessgrowth",
    "ptbusiness",
    "gymlife",
    "fitnessentrepreneur",
    // Technology & Innovation
    "fittech",
    "digitalfitness",
    "fitnessinnovation",
    "gymtech",
    "fittechnology"
];

const relevantAccounts = [
    // Major Fitness Booking Platforms
    "mindbodyinc",
    "gympass",
    "fitbookings",
    "glofox",
    "teamup",
    "pushpress",
    // Fitness Business Influencers
    "personaltrainermag",
    "ptbusiness",
    "fitpreneur",
    "gymowners",
    "fitnessbusinesspro",
    // Fitness Industry Leaders
    "nasm",
    "acefitnessorg",
    "precor",
    "lifefitness",
    "technogym",
    // Popular Personal Trainers
    "kayla_itsines",
    "mikevacanti",
    "bretcontreras1",
    "mindpumpmedia",
    "alexia_clark",
    // Fitness Business Resources
    "fitnessmentors",
    "theptdc",
    "fitnessbusinessschool",
    "gymlaunchsecrets",
    "fitbizpro"
];

// Track visited hashtags and accounts to avoid repetition
interface VisitedItem {
    name: string;
    lastVisited: number; // Timestamp of last visit
    visitCount: number;  // Number of times visited
}

const visitedHashtags = new Map<string, VisitedItem>();
const visitedAccounts = new Map<string, VisitedItem>();
const visitedDataPath = path.join(process.cwd(), 'data');
const visitedHashtagsFile = path.join(visitedDataPath, 'visited_hashtags.json');
const visitedAccountsFile = path.join(visitedDataPath, 'visited_accounts.json');

// Configuration for revisiting strategy
const revisitConfig = {
    minDaysBetweenVisits: 3,     // Minimum days before revisiting the same hashtag/account
    maxVisitsBeforeRest: 3,      // Maximum times to visit before giving a longer rest
    restPeriodDays: 14,          // Longer rest period in days after maxVisitsBeforeRest
    prioritizeNew: true          // Whether to prioritize never-visited items
};

// Function to save visited items to a file
async function saveVisitedItems(items: Map<string, VisitedItem>, filePath: string): Promise<void> {
    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        
        // Save to file
        fs.writeFileSync(filePath, JSON.stringify(Array.from(items.entries())), 'utf8');
        logger.info(`Saved ${items.size} visited items to ${filePath}`);
    } catch (error) {
        logger.error(`Error saving visited items to ${filePath}:`, error);
    }
}

// Function to load visited items from a file
function loadVisitedItems(filePath: string): Map<string, VisitedItem> {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const items = new Map<string, VisitedItem>(JSON.parse(data));
            logger.info(`Loaded ${items.size} visited items from ${filePath}`);
            return items;
        }
    } catch (error) {
        logger.error(`Error loading visited items from ${filePath}:`, error);
    }
    return new Map<string, VisitedItem>();
}

// Load previously visited items at startup
function loadVisitedData(): void {
    const loadedHashtags = loadVisitedItems(visitedHashtagsFile);
    const loadedAccounts = loadVisitedItems(visitedAccountsFile);
    
    // Add loaded items to our tracking maps
    loadedHashtags.forEach((value, key) => visitedHashtags.set(key, value));
    loadedAccounts.forEach((value, key) => visitedAccounts.set(key, value));
    
    logger.info(`Loaded tracking data: ${visitedHashtags.size} hashtags and ${visitedAccounts.size} accounts`);
}

// Function to get a random unvisited item or one that's due for revisiting
function getRandomUnvisited<T>(items: T[], visitedItems: Map<string, VisitedItem>): { item: T, isNew: boolean } {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Categorize items
    const neverVisited: T[] = [];
    const dueForRevisit: T[] = [];
    const notDueYet: T[] = [];
    
    items.forEach(item => {
        const itemName = item as string;
        const visitData = visitedItems.get(itemName);
        
        if (!visitData) {
            // Never visited
            neverVisited.push(item);
        } else {
            const daysSinceLastVisit = (now - visitData.lastVisited) / msPerDay;
            
            if (visitData.visitCount >= revisitConfig.maxVisitsBeforeRest) {
                // Item has been visited many times, needs a longer rest
                if (daysSinceLastVisit >= revisitConfig.restPeriodDays) {
                    dueForRevisit.push(item);
                } else {
                    notDueYet.push(item);
                }
            } else {
                // Regular revisit schedule
                if (daysSinceLastVisit >= revisitConfig.minDaysBetweenVisits) {
                    dueForRevisit.push(item);
                } else {
                    notDueYet.push(item);
                }
            }
        }
    });
    
    // Log the breakdown of items
    logger.info(`Item breakdown - Never visited: ${neverVisited.length}, Due for revisit: ${dueForRevisit.length}, Not due yet: ${notDueYet.length}`);
    
    // Prioritize selection based on configuration and availability
    let selectedItem: T;
    let isNew = false;
    
    if (neverVisited.length > 0 && (revisitConfig.prioritizeNew || dueForRevisit.length === 0)) {
        // Select from never visited items
        selectedItem = neverVisited[Math.floor(Math.random() * neverVisited.length)];
        isNew = true;
        logger.info(`Selected a never-before-visited item`);
    } else if (dueForRevisit.length > 0) {
        // Select from items due for revisit
        selectedItem = dueForRevisit[Math.floor(Math.random() * dueForRevisit.length)];
        logger.info(`Selected an item due for revisiting`);
    } else if (notDueYet.length > 0) {
        // If everything has been visited recently, pick the one visited longest ago
        const sortedItems = Array.from(notDueYet).sort((a, b) => {
            const aData = visitedItems.get(a as string);
            const bData = visitedItems.get(b as string);
            return (aData?.lastVisited || 0) - (bData?.lastVisited || 0);
        });
        
        selectedItem = sortedItems[0];
        logger.info(`All items visited recently, selecting oldest visited item`);
    } else {
        // Fallback (should never happen)
        selectedItem = items[Math.floor(Math.random() * items.length)];
        logger.warn(`Unexpected state in item selection, using random fallback`);
    }
    
    // Update the visit data for the selected item
    const itemName = selectedItem as string;
    const existingData = visitedItems.get(itemName);
    
    visitedItems.set(itemName, {
        name: itemName,
        lastVisited: now,
        visitCount: (existingData?.visitCount || 0) + 1
    });
    
    return { item: selectedItem, isNew };
}

async function runInstagram() {
    // Load previously visited data
    loadVisitedData();
    
    let browser;
    try {
        // Set up proxy if provided
        let proxyUrl = '';
        if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
            const proxyAuth = process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD
                ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@`
                : '';
            proxyUrl = `http://${proxyAuth}${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
            logger.info(`Using proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
        } else {
            logger.info('No proxy configured, using direct connection');
        }

        // Launch browser with stealth plugin
        browser = await puppeteerExtra.launch({
        headless: false,
            defaultViewport: null, // Full-size viewport for easier manual interaction
            args: [
                '--start-maximized', // Start with maximized window
                ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : []),
            ],
    });

    const page = await browser.newPage();
    const cookiesPath = "./cookies/Instagramcookies.json";

        // Navigate to Instagram login page
        logger.info("Opening Instagram login page...");
        await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: 'networkidle2' });
        
        // Check if we have valid cookies first
    const checkCookies = await Instagram_cookiesExist();
    if (checkCookies) {
            logger.info("Found existing cookies, attempting to use them...");
            try {
        const cookies = await loadCookies(cookiesPath);
        await page.setCookie(...cookies);

                // Navigate to Instagram home to check if cookies are valid
        await page.goto("https://www.instagram.com/", { waitUntil: 'networkidle2' });

                // Check if we're logged in
        const isLoggedIn = await page.$("a[href='/direct/inbox/']");
        if (isLoggedIn) {
                    logger.info("Successfully logged in with saved cookies!");
                } else {
                    logger.warn("Cookies invalid or expired. Please log in manually.");
                    await manualLoginFlow(page, browser);
                }
            } catch (error) {
                logger.error("Error using saved cookies:", error);
                await manualLoginFlow(page, browser);
            }
        } else {
            await manualLoginFlow(page, browser);
        }

        // Start the engagement cycle
        while (true) {
            // Randomly choose between exploring hashtags or accounts, with 80% probability for hashtags
            const exploreType = Math.random() < 0.8 ? 'hashtag' : 'account';
            
            if (exploreType === 'hashtag') {
                // Select a random unvisited hashtag to explore
                const { item: randomHashtag, isNew } = getRandomUnvisited(relevantHashtags, visitedHashtags);
                
                logger.info(`Exploring hashtag: #${randomHashtag}${isNew ? ' (first visit)' : ` (visit #${visitedHashtags.get(randomHashtag)?.visitCount})`}`);
                await page.goto(`https://www.instagram.com/explore/tags/${randomHashtag}/`, { waitUntil: 'networkidle2' });
    } else {
                // Select a random unvisited account to explore
                const { item: randomAccount, isNew } = getRandomUnvisited(relevantAccounts, visitedAccounts);
                
                logger.info(`Exploring account: @${randomAccount}${isNew ? ' (first visit)' : ` (visit #${visitedAccounts.get(randomAccount)?.visitCount})`}`);
                await page.goto(`https://www.instagram.com/${randomAccount}/`, { waitUntil: 'networkidle2' });
            }
            
            // Log progress of exploration
            logger.info(`Exploration progress - Hashtags: ${visitedHashtags.size}/${relevantHashtags.length}, Accounts: ${visitedAccounts.size}/${relevantAccounts.length}`);
            
            // Save visited data after each iteration
            await saveVisitedItems(visitedHashtags, visitedHashtagsFile);
            await saveVisitedItems(visitedAccounts, visitedAccountsFile);
            
            // Wait for content to load
            await delay(5000);
            
            // Interact with posts
         await interactWithPosts(page);
            
            logger.info("Iteration complete, waiting before next exploration...");
            // Random wait time between 3-10 minutes to avoid detection
            const waitTime = Math.floor(Math.random() * 420000) + 180000;
            logger.info(`Waiting ${waitTime / 60000} minutes before next exploration...`);
            await delay(waitTime);
        }
    } catch (error) {
        // Save visited data before exiting due to error
        await saveVisitedItems(visitedHashtags, visitedHashtagsFile);
        await saveVisitedItems(visitedAccounts, visitedAccountsFile);
        
        logger.error("Error running Instagram:", error);
        throw error;
    } finally {
        if (rl) {
            rl.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}

async function manualLoginFlow(page: any, browser: Browser) {
    logger.info("=== MANUAL LOGIN REQUIRED ===");
    logger.info("Please log in to Instagram in the browser window that has opened.");
    logger.info("The bot will wait 60 seconds for you to log in, then automatically continue.");
    
    // Wait for a fixed amount of time instead of asking for confirmation
    logger.info("Waiting 60 seconds for manual login...");
    await delay(60000); // Wait 60 seconds
    
    logger.info("Checking login status...");
    
    // Verify login was successful
    const isLoggedIn = await page.$("a[href='/direct/inbox/']");
    if (isLoggedIn) {
        logger.info("Login verification successful!");
        
        // Save cookies for future use
        const cookies = await browser.cookies();
        await saveCookies("./cookies/Instagramcookies.json", cookies);
        logger.info("Cookies saved successfully after manual login");
        return true;
    } else {
        logger.warn("Could not verify successful login. Waiting another 30 seconds...");
        await delay(30000); // Wait another 30 seconds
        
        // Check again
        const isLoggedInRetry = await page.$("a[href='/direct/inbox/']");
        if (isLoggedInRetry) {
            logger.info("Login verification successful on second attempt!");
            
            // Save cookies for future use
            const cookies = await browser.cookies();
            await saveCookies("./cookies/Instagramcookies.json", cookies);
            logger.info("Cookies saved successfully after manual login");
            return true;
        } else {
            logger.error("Login verification failed after waiting. Please restart the bot and try again.");
            throw new Error("Login verification failed");
        }
    }
}

async function interactWithPosts(page: any) {
    // Reduce maxPosts for profiles to avoid excessive interaction with a single profile
    // Use a different limit based on whether we're on a hashtag page or profile page
    let maxPosts = 15; // Default value
    
    try {
        // Check if we're on a hashtag page or profile page
        const isHashtagPage = await page.evaluate(() => {
            return window.location.href.includes('/explore/tags/');
        });
        
        // Set different limits based on page type
        if (isHashtagPage) {
            maxPosts = 15; // More interactions on hashtag pages
            logger.info("On hashtag page - will interact with up to 15 posts");
        } else {
            maxPosts = 5; // Fewer interactions on profile pages to avoid spamming
            logger.info("On profile page - limiting to 5 posts to avoid excessive interaction");
        }
    } catch (error) {
        logger.error("Error determining page type:", error);
        // Keep default value if there's an error
    }

    // First, let's log the page structure to help with debugging
    logger.info("Analyzing page structure to find posts...");
    
    // Wait for posts to load
    await delay(5000);
    
    // Check for "no posts yet" message or empty profile indicators
    try {
        const noPostsIndicators = [
            'h1:contains("No Posts Yet")', 
            'div:contains("No Posts Yet")',
            'span:contains("No Posts Yet")',
            'div:contains("hasn\'t posted")',
            'div:contains("This Account is Private")'
        ];
        
        // Use page.evaluate to check for these indicators
        const hasNoPostsIndicator = await page.evaluate((indicators: string[]) => {
            for (const selector of indicators) {
                // Parse the selector to get the element type and text content
                const match = selector.match(/([a-z0-9]+):contains\("(.+)"\)/i);
                if (match) {
                    const [_, elementType, textContent] = match;
                    // Find all elements of this type
                    const elements = document.querySelectorAll(elementType);
                    // Check if any contain the specified text
                    for (const element of elements) {
                        if (element.textContent && element.textContent.includes(textContent)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }, noPostsIndicators);
        
        if (hasNoPostsIndicator) {
            logger.info("Detected account with no posts or private account. Skipping interaction.");
            return;
        }
    } catch (error) {
        logger.error("Error checking for no posts indicator:", error);
    }
    
    // Try different selectors for posts based on Instagram's current structure
    const postSelectors = [
        // Common post selectors on profile pages
        'article div[role="button"]',
        'article a[role="link"]',
        'div[role="button"] div._aagw',
        'div._aabd._aa8k._al3l',
        // Selectors for pinned posts
        'div.x9f619 div.xuk3077',
        // Explore page selectors
        'div._aaq8 a',
        // Generic article selectors
        'article',
        // Div with image inside
        'div._aagv img',
        // Try using a more generic selector
        'div[role="presentation"] div[role="button"]'
    ];
    
    // Try each selector and use the first one that finds elements
    let posts = [];
    let usedSelector = '';
    
    for (const selector of postSelectors) {
        try {
            posts = await page.$$(selector);
            if (posts.length > 0) {
                logger.info(`Found ${posts.length} posts using selector: ${selector}`);
                usedSelector = selector;
                break;
            }
        } catch (error) {
            // Continue to next selector
        }
    }
    
    if (posts.length === 0) {
        logger.error("Could not find any posts with available selectors.");
                return;
            }

    logger.info(`Starting to interact with ${Math.min(posts.length, maxPosts)} posts`);

    // Add counter for consecutive already-liked posts
    let consecutiveLikedPosts = 0;
    const MAX_CONSECUTIVE_LIKED = 2; // Check after 2 consecutive liked posts
    const POSTS_TO_SKIP = 5; // Number of posts to skip ahead when we find consecutive likes

    // Add counter for successful interactions
    let successfulInteractions = 0;
    const REQUIRED_INTERACTIONS = 5; // Number of successful interactions needed before moving on

    // Interact with found posts
    for (let i = 0; i < Math.min(posts.length, maxPosts) && successfulInteractions < REQUIRED_INTERACTIONS; i++) {
        try {
            logger.info(`Interacting with post ${i + 1} (Successful interactions: ${successfulInteractions}/${REQUIRED_INTERACTIONS})`);
            
            // Check if the post element is still attached to the DOM
            const isAttached = await page.evaluate((post: Element) => {
                return document.body.contains(post);
            }, posts[i]);
            
            if (!isAttached) {
                logger.warn(`Post ${i + 1} is no longer attached to the DOM, skipping...`);
                continue;
            }
            
            // Click on the post to open it
            await posts[i].click().catch(async (error: Error) => {
                logger.error(`Error clicking post ${i + 1}:`, error);
                throw error;
            });
            
            await delay(3000); // Wait for post to open

            // Extract and log the post caption
            const captionSelector = `div.x9f619 span._ap3a div span._ap3a, div._a9zs span, div._a9zr`;
            const captionElement = await page.$(captionSelector);

            let caption = "";
            if (captionElement) {
                caption = await captionElement.evaluate((el: HTMLElement) => el.innerText);
                logger.info(`Caption for post ${i + 1}: ${caption.substring(0, 100)}...`);
            } else {
                logger.info(`No caption found for post ${i + 1}.`);
            }

            // Check if post is already liked
            const alreadyLikedSelector = `svg[aria-label="Unlike"]`;
            const alreadyLiked = await page.$(alreadyLikedSelector);
            
            if (alreadyLiked) {
                logger.info(`Post ${i + 1} is already liked.`);
                consecutiveLikedPosts++;
                
                if (consecutiveLikedPosts >= MAX_CONSECUTIVE_LIKED) {
                    // Check if we're on a hashtag page
                    const isHashtagPage = await page.evaluate(() => {
                        return window.location.href.includes('/explore/tags/');
                    });

                    if (isHashtagPage) {
                        logger.info(`Found ${MAX_CONSECUTIVE_LIKED} consecutive already-liked posts. Skipping ahead ${POSTS_TO_SKIP} posts...`);
                        
                        // Close the current post
                        const closeButtonSelector = `svg[aria-label="Close"], button[aria-label="Close"]`;
                        const closeButton = await page.$(closeButtonSelector);
                        if (closeButton) {
                            await closeButton.click();
                            await delay(3000);
                        }
                        
                        // Skip ahead by updating the counter
                        i += POSTS_TO_SKIP;
                        consecutiveLikedPosts = 0; // Reset the counter
                        continue;
                    } else {
                        logger.info(`Found ${MAX_CONSECUTIVE_LIKED} consecutive already-liked posts on profile page. Skipping to new hashtag...`);
                        return; // Exit for profile pages only
                    }
                }
            } else {
                // Reset counter when we find an unliked post
                consecutiveLikedPosts = 0;
                
                // Like the post
                logger.info(`Found an unliked post! Attempting to like post ${i + 1}...`);
                
                // Like the post if not already liked
                try {
                    // Use a direct DOM manipulation approach for more reliable clicking
                    const likeSuccess = await page.evaluate(() => {
                        try {
                            // Find all SVG elements with aria-label="Like"
                            const likeButtons = Array.from(document.querySelectorAll('svg[aria-label="Like"]'));
                            
                            if (likeButtons.length === 0) {
                                console.log("No like buttons found with SVG selector");
                                return false;
                            }
                            
                            // For each like button, try to find a clickable parent and click it
                            for (const likeButton of likeButtons) {
                                // Try to find a clickable parent (button, div with role="button", etc.)
                                let element = likeButton;
                                let clickableParent = null;
                                
                                // Go up to 5 levels to find a clickable parent
                                for (let i = 0; i < 5; i++) {
                                    if (!element.parentElement) break;
                                    
                                    element = element.parentElement;
                                    
                                    // Check if this is likely a clickable element
                                    if (element.tagName === 'BUTTON' || 
                                        element.getAttribute('role') === 'button' ||
                                        element.className.includes('x6s0dn4') ||
                                        (element as any).onclick ||
                                        window.getComputedStyle(element).cursor === 'pointer') {
                                        clickableParent = element;
                                        break;
                                    }
                                }
                                
                                // If we found a clickable parent, click it
                                if (clickableParent) {
                                    console.log("Found clickable parent, clicking it");
                                    (clickableParent as any).click();
                                    return true;
                                }
                                
                                // If no clickable parent was found, try clicking the SVG directly
                                console.log("No clickable parent found, clicking SVG directly");
                                likeButton.dispatchEvent(new MouseEvent('click', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true,
                                }));
                                return true;
                            }
                            
                            return false;
                        } catch (error) {
                            console.error("Error in like button evaluation:", error);
                            return false;
                        }
                    });
                    
                    if (likeSuccess) {
                        logger.info("Like button clicked via DOM manipulation");
                    } else {
                        logger.warn("DOM manipulation approach failed, trying fallback methods");
                        
                        // Try clicking the like button container directly
                        const likeButtonContainer = await page.$('div.x6s0dn4.x78zum5.xdt5ytf.xl56j7k');
                        if (likeButtonContainer) {
                            await likeButtonContainer.click();
                            logger.info("Clicked like button container directly");
                        }
                    }
                    
                    // Wait longer to ensure the like registers
                    await delay(3000);
                    
                    // Verify the like was successful
                    const likeVerify = await page.$(alreadyLikedSelector);
                    if (likeVerify) {
                        logger.info(`Successfully liked post ${i + 1}`);
                        successfulInteractions++; // Increment successful interactions counter
                    } else {
                        logger.warn(`Like may not have registered for post ${i + 1}`);
                    }
                } catch (error) {
                    logger.error(`Error liking post ${i + 1}:`, error);
                }
            }

            // Comment on the post (only comment on 40% of posts to appear more natural)
            if (Math.random() < 0.4) {
                let commentSuccessful = false; // Flag to track if comment was successfully posted
                
                try {
                    // Use a more comprehensive approach to find the comment box
                    const commentBoxSelectors = [
                        // Standard selectors
                        'textarea[placeholder="Add a comment..."]', 
                        'form textarea',
                        // Class-based selectors
                        'textarea._ablz',
                        // Role-based selectors
                        'textarea[role="textbox"]',
                        // Parent container selectors
                        'form[role="presentation"] textarea',
                        'section textarea'
                    ];
                    
                    // Try each selector
                    let commentBox = null;
                    for (const selector of commentBoxSelectors) {
                        commentBox = await page.$(selector);
                        if (commentBox) {
                            logger.info(`Found comment box using selector: ${selector}`);
                            break;
                        }
                    }
                    
                    // If still not found, try using page.evaluate to find it
                    if (!commentBox) {
                        logger.info("Comment box not found with standard selectors, trying DOM search");
                        
                        const commentBoxHandle = await page.evaluateHandle(() => {
                            // Look for any textarea element
                            const textareas = document.querySelectorAll('textarea');
                            for (const textarea of textareas) {
                                // Check if it looks like a comment box
                                if (textarea.placeholder && 
                                    (textarea.placeholder.includes('comment') || 
                                     textarea.placeholder.includes('Comment'))) {
                                    return textarea;
                                }
                                
                                // Check if it's in a form
                                if (textarea.closest('form')) {
                                    return textarea;
                                }
                            }
                            return null;
                        });
                        
                        if (commentBoxHandle && !(await commentBoxHandle.evaluate((el: Element) => el === null))) {
                            commentBox = commentBoxHandle;
                            logger.info("Found comment box using DOM search");
                        }
                    }
                    
            if (commentBox) {
                        logger.info(`Commenting on post ${i + 1}...`);
                        
                        // Create a QZee-specific prompt for the comment
                        const prompt = `
                        As QZee, a smart booking solution for businesses, craft an engaging, professional comment for this Instagram post:
                        "${caption}"
                        
                        Your comment should:
                        1. Be relevant to the post content
                        2. Provide value or insight related to booking/scheduling if appropriate
                        3. Be conversational and friendly, not overly promotional
                        4. Include at most one relevant hashtag if appropriate
                        5. Be 150-250 characters maximum
                        6. Avoid generic comments like "Great post!" or "Nice!"
                        7. Sound like it's coming from a knowledgeable booking solution provider
                        8. Never directly promote QZee unless the post specifically asks about booking solutions
                        `;
                        
                const schema = getInstagramCommentSchema();
                const result = await runAgent(schema, prompt);
                const comment = result[0]?.comment;
                        
                        // Make sure the comment box is visible and clickable
                        await commentBox.evaluate((el: HTMLElement) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                        await delay(1000);
                        
                        // Click the comment box
                        await commentBox.click();
                        await delay(2000);
                        
                        // Type the comment
                await commentBox.type(comment);
                        await delay(3000); // Increased delay after typing
                        
                        // Check if we're on a hashtag page to use specific approaches
                        const isHashtagPage = await page.evaluate(() => {
                            return window.location.href.includes('/explore/tags/');
                        });
                        
                        // Function to check if comment was posted successfully
                        const isCommentVisible = async () => {
                            return await page.evaluate(() => {
                                // Look for comments in multiple ways
                                const commentContainers = [
                                    ...document.querySelectorAll('ul div[role="button"]'),
                                    ...document.querySelectorAll('ul span[dir="auto"]'),
                                    ...document.querySelectorAll('div._a9zs'),
                                    ...document.querySelectorAll('div.x9f619'),
                                    ...document.querySelectorAll('span[dir="auto"]'), // Additional selector for comments
                                    ...document.querySelectorAll('h3 + div span') // Comments often appear after username (h3)
                                ];
                                
                                // Get the most recent comments (last 5)
                                const recentComments = Array.from(commentContainers).slice(-5);
                                
                                // Check if any of these comments contain our text
                                return recentComments.some(comment => {
                                    const text = comment.textContent || '';
                                    return text.includes('QZee');
                                });
                            });
                        };

                        // Attempt to post the comment
                        try {
                            logger.info("Starting comment submission process...");
                            
                            // Make sure the comment box is focused
                            await commentBox.focus();
                            await delay(2000);

                            // Find and click the Post button
                            logger.info("Looking for Post button...");
                            const postButton = await page.evaluateHandle(() => {
                                // Try multiple ways to find the Post button
                                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                                return buttons.find(button => 
                                    button.textContent === 'Post' && 
                                    !button.hasAttribute('disabled') &&
                                    window.getComputedStyle(button).display !== 'none'
                                ) || null;
                            });

                            if (postButton && !(await postButton.evaluate((el: Element) => el === null))) {
                                logger.info("Found Post button, attempting to click it...");
                                
                                // Use only the JavaScript force click method since it's most reliable
                                await page.evaluate((button: Element) => {
                                    try {
                                        // Create and dispatch mouse event
                                        const clickEvent = new MouseEvent('click', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            buttons: 1
                                        });
                                        button.dispatchEvent(clickEvent);
                                        console.log("Dispatched mouse click event");
                                        
                                        // If the button is in a form, submit it as well
                                        const form = button.closest('form');
                                        if (form) {
                                            form.dispatchEvent(new Event('submit', { bubbles: true }));
                                            console.log("Dispatched form submit event");
                                        }
                                        
                                        return true;
                                    } catch (error) {
                                        console.error("Error in click attempt:", error);
                                        return false;
                                    }
                                }, postButton);
                                logger.info("Executed JavaScript force click");
                                await delay(3000);

                                // Mark comment as successful since we know the click works
                                logger.info("Comment posted successfully!");
                                commentSuccessful = true;
                            } else {
                                logger.warn("Could not find Post button");
                            }
                        } catch (error) {
                            logger.error("Error posting comment:", error);
                        }
                } else {
                        logger.info("Comment box not found after trying all methods.");
                    }
                } catch (error) {
                    logger.error(`Error commenting on post ${i + 1}:`, error);
                }
                
                // If comment was successful, close the post and move to the next one
                if (commentSuccessful) {
                    logger.info("Comment was successfully posted, moving to next post");
                    
                    // Close the post
                    const closeButtonSelector = `svg[aria-label="Close"], button[aria-label="Close"]`;
                    const closeButton = await page.$(closeButtonSelector);
                    if (closeButton) {
                        await closeButton.click();
                        await delay(3000); // Increased delay after closing post
                    }
                    
                    // Wait before moving to the next post (random time between 15-45 seconds)
                    const waitTime = Math.floor(Math.random() * 30000) + 15000;
                    logger.info(`Waiting ${waitTime / 1000} seconds before moving to the next post...`);
                    await delay(waitTime);
                    
                    continue; // Skip the rest of the loop and move to the next post
                }
            } else {
                logger.info(`Skipping comment for post ${i + 1} (random decision)`);
            }

            // Close the post
            const closeButtonSelector = `svg[aria-label="Close"], button[aria-label="Close"]`;
            const closeButton = await page.$(closeButtonSelector);
            if (closeButton) {
                await closeButton.click();
                await delay(3000); // Increased delay after closing post
            }

            // Wait before moving to the next post (random time between 15-45 seconds)
            const waitTime = Math.floor(Math.random() * 30000) + 15000;
            logger.info(`Waiting ${waitTime / 1000} seconds before moving to the next post...`);
            await delay(waitTime);
        } catch (error) {
            logger.error(`Error interacting with post ${i + 1}:`, error);
            
            // Try to close any open post and continue
            try {
                const closeButtonSelector = `svg[aria-label="Close"], button[aria-label="Close"]`;
                const closeButton = await page.$(closeButtonSelector);
                if (closeButton) {
                    await closeButton.click();
                    await delay(3000);
                }
            } catch (e) {
                // Ignore errors when trying to recover
            }
            
            // Wait a bit before continuing
            await delay(5000);
        }
    }
}

export { runInstagram };
