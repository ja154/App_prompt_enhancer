import React, { useState, useEffect, useRef } from 'react';

// Main App Component
const App = () => {
    // State variables
    const [simpleIdea, setSimpleIdea] = useState(''); // User's initial simple idea
    const [enhancedPrompt, setEnhancedPrompt] = useState(''); // AI-enhanced prompt
    const [customPrompt, setCustomPrompt] = useState(''); // User-customized prompt (editable)
    const [appPreview, setAppPreview] = useState(null); // AI-generated app preview (now an object)
    const [isLoadingEnhance, setIsLoadingEnhance] = useState(false); // Loading state for prompt enhancement
    const [isLoadingPreview, setIsLoadingPreview] = useState(false); // Loading state for app preview
    const [error, setError] = useState(''); // Error messages
    const [isPromptEnhanced, setIsPromptEnhanced] = useState(false); // Flag to track if prompt has been enhanced

    // New states for additional functionalities
    const [appNamesSlogans, setAppNamesSlogans] = useState(null); // Stores generated names and taglines
    const [monetizationStrategies, setMonetizationStrategies] = useState(null); // Stores suggested monetization models
    const [techStackSuggestions, setTechStackSuggestions] = useState(null); // Stores high-level tech stack recommendations

    // New loading states for additional functionalities
    const [isLoadingNames, setIsLoadingNames] = useState(false);
    const [isLoadingMonetization, setIsLoadingMonetization] = useState(false);
    const [isLoadingTechStack, setIsLoadingTechStack] = useState(false);


    // Ref for scrolling to the enhanced prompt section
    const enhancedPromptRef = useRef(null);
    // Ref for scrolling to the app preview section
    const appPreviewRef = useRef(null);

    // Initialize Firebase config and app ID if needed (though not directly used for Gemini API calls here)
    // These are provided globally in the Canvas environment
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

    // --- Helper Functions ---

    /**
     * Clears any previous error messages.
     */
    const clearError = () => {
        setError('');
    };

    /**
     * Scrolls to a given ref if it exists.
     * @param {React.RefObject<HTMLElement>} ref - The ref to scroll to.
     */
    const scrollToRef = (ref) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    /**
     * Calls the Gemini API to generate content.
     * @param {string} promptText - The text to send to the Gemini API.
     * @param {string} modelName - The Gemini model to use (e.g., 'gemini-2.0-flash').
     * @param {object} responseSchema - Optional, JSON schema for structured response.
     * @returns {Promise<string|object>} - A promise that resolves with the generated text or parsed JSON object.
     */
    const callGeminiApi = async (promptText, modelName = 'gemini-2.0-flash', responseSchema = null) => {
        clearError();
        let chatHistory = [{ role: 'user', parts: [{ text: promptText }] }];
        const payload = { contents: chatHistory };

        if (responseSchema) {
            payload.generationConfig = {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            };
        }

        // The API key is automatically provided by the Canvas environment if left empty
        const apiKey = '';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Check if response is OK but potentially empty or non-JSON
            if (!response.ok) {
                const errorData = await response.json(); // Attempt to parse error details if available
                throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            // Get the raw text of the response first
            const rawResponseText = await response.text();

            if (!rawResponseText) {
                throw new Error('Empty response from AI. Please try again.');
            }

            let result;
            try {
                result = JSON.parse(rawResponseText);
            } catch (jsonParseError) {
                // If rawResponseText is not valid JSON, it's an unexpected format
                throw new Error(`AI returned invalid response format: ${rawResponseText.substring(0, 100)}... (Error: ${jsonParseError.message})`);
            }

            if (
                result.candidates &&
                result.candidates.length > 0 &&
                result.candidates[0].content &&
                result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0
            ) {
                const textResult = result.candidates[0].content.parts[0].text;
                if (responseSchema) {
                    try {
                        return JSON.parse(textResult);
                    } catch (jsonError) {
                        console.error("Failed to parse JSON from AI response:", textResult, jsonError);
                        throw new Error("AI returned invalid JSON within its content. Please try again.");
                    }
                }
                return textResult;
            } else {
                throw new Error('Unexpected API response structure or no content generated.');
            }
        } catch (err) {
            console.error('Error calling Gemini API:', err);
            setError(`Failed to connect to AI: ${err.message}. Please try again.`);
            return responseSchema ? {} : ''; // Return empty object/string based on expected type
        }
    };

    // --- Event Handlers ---

    /**
     * Handles the prompt enhancement process.
     * Takes the simple idea and asks Gemini to expand it.
     */
    const handleEnhancePrompt = async () => {
        if (!simpleIdea.trim()) {
            setError('Please enter a simple idea to enhance.');
            return;
        }

        setIsLoadingEnhance(true);
        setAppPreview(null); // Clear previous app preview
        setEnhancedPrompt(''); // Clear previous enhanced prompt
        setCustomPrompt(''); // Clear custom prompt
        setAppNamesSlogans(null); // Clear previous
        setMonetizationStrategies(null); // Clear previous
        setTechStackSuggestions(null); // Clear previous

        const enhancementPrompt = `You are an expert AI app developer. A user has a simple idea for an app. Your task is to expand this simple idea into a comprehensive, detailed, and inclusive prompt that can be used to generate a full app specification. Consider aspects like target audience, core features, key functionalities, potential user roles, non-functional requirements (performance, security, scalability), UI/UX considerations, and monetization strategies if applicable.
        The output should be a well-structured prompt, ready to be fed into another AI model for app generation.
        User's simple idea: '${simpleIdea}'`;

        try {
            const generatedPrompt = await callGeminiApi(enhancementPrompt);
            if (generatedPrompt) {
                setEnhancedPrompt(generatedPrompt);
                setCustomPrompt(generatedPrompt); // Initialize customPrompt with the generated prompt
                setIsPromptEnhanced(true);
                // Scroll to the enhanced prompt section after generation
                setTimeout(() => scrollToRef(enhancedPromptRef), 100);
            }
        } finally {
            setIsLoadingEnhance(false);
        }
    };

    /**
     * Handles the app preview generation process.
     * Uses the (potentially customized) enhanced prompt to get a conceptual app description from Gemini.
     */
    const handleGenerateAppPreview = async () => {
        const promptToUse = customPrompt.trim(); // Use the customized prompt if available

        if (!promptToUse) {
            setError('Please enhance a prompt first or provide a custom prompt.');
            return;
        }

        setIsLoadingPreview(true);
        setAppPreview(null); // Clear previous app preview
        setAppNamesSlogans(null); // Clear previous
        setMonetizationStrategies(null); // Clear previous
        setTechStackSuggestions(null); // Clear previous

        // Modified prompt to request JSON output for structured preview
        const appPreviewGenerationPrompt = `Based on the following detailed app prompt, describe a conceptual overview and key features of the application. Provide the output as a JSON object with the following keys:
- "appName": (string) A suggested short, descriptive name for the app.
- "tagline": (string) A short, catchy phrase summarizing the app.
- "description": (string) A detailed overview of what the app does, who it's for, and its primary functionalities.
- "keyFeatures": (array of strings) A list of the most important features.
- "targetAudience": (string) The primary users the app is designed for.

Ensure the output is valid JSON.
Detailed App Prompt: '${promptToUse}'`;

        // Define schema for app preview
        const appPreviewSchema = {
            type: "OBJECT",
            properties: {
                appName: { type: "STRING" },
                tagline: { type: "STRING" },
                description: { type: "STRING" },
                keyFeatures: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                targetAudience: { type: "STRING" }
            },
            required: ["appName", "tagline", "description", "keyFeatures", "targetAudience"] // Corrected typo: targetAudient -> targetAudience
        };

        try {
            const parsedPreview = await callGeminiApi(appPreviewGenerationPrompt, 'gemini-2.0-flash', appPreviewSchema);
            if (parsedPreview && parsedPreview.description) { // Check for a critical field
                setAppPreview(parsedPreview); // Store the object
                // Scroll to the app preview section after generation
                setTimeout(() => scrollToRef(appPreviewRef), 100);
            } else {
                setError("Failed to generate a structured app preview. The AI might not have returned complete data or valid JSON.");
                setAppPreview(null);
            }
        } catch (e) {
            // Error already set by callGeminiApi
            setAppPreview(null); // Clear preview on error
        } finally {
            setIsLoadingPreview(false);
        }
    };

    /**
     * Generates app names and slogans.
     */
    const handleGenerateNamesSlogans = async () => {
        if (!appPreview || !appPreview.description) {
            setError('Please generate an app preview first.');
            return;
        }

        setIsLoadingNames(true);
        setAppNamesSlogans(null); // Clear previous results

        const namesSlogansPrompt = `Generate 5 creative and catchy app names and 5 taglines for an app based on the following description. Provide the output as a JSON object with two keys: "names" (array of strings) and "taglines" (array of strings).
        App Description: ${appPreview.description}`;

        const namesSlogansSchema = {
            type: "OBJECT",
            properties: {
                names: { type: "ARRAY", items: { type: "STRING" } },
                taglines: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["names", "taglines"]
        };

        try {
            const result = await callGeminiApi(namesSlogansPrompt, 'gemini-2.0-flash', namesSlogansSchema);
            if (result && result.names && result.taglines) {
                setAppNamesSlogans(result);
            } else {
                setError("Failed to generate names/slogans. AI response was incomplete or malformed.");
                setAppNamesSlogans(null);
            }
        } finally {
            setIsLoadingNames(false);
        }
    };

    /**
     * Generates monetization strategies.
     */
    const handleGenerateMonetizationStrategies = async () => {
        if (!appPreview || !appPreview.description) {
            setError('Please generate an app preview first.');
            return;
        }

        setIsLoadingMonetization(true);
        setMonetizationStrategies(null); // Clear previous results

        const monetizationPrompt = `Based on the following app description, suggest 3-5 potential monetization strategies. For each strategy, briefly explain how it would work for this app. Provide the output as a JSON object with a single key "strategies" (array of objects, each with "name" and "description" keys).
        App Description: ${appPreview.description}`;

        const monetizationSchema = {
            type: "OBJECT",
            properties: {
                strategies: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            description: { type: "STRING" }
                        },
                        required: ["name", "description"]
                    }
                }
            },
            required: ["strategies"]
        };

        try {
            const result = await callGeminiApi(monetizationPrompt, 'gemini-2.0-flash', monetizationSchema);
            if (result && result.strategies) {
                setMonetizationStrategies(result.strategies);
            } else {
                setError("Failed to generate monetization strategies. AI response was incomplete or malformed.");
                setMonetizationStrategies(null);
            }
        } finally {
            setIsLoadingMonetization(false);
        }
    };

    /**
     * Generates high-level tech stack suggestions.
     */
    const handleGenerateTechStack = async () => {
        if (!appPreview || !appPreview.description) {
            setError('Please generate an app preview first.');
            return;
        }

        setIsLoadingTechStack(true);
        setTechStackSuggestions(null); // Clear previous results

        const techStackPrompt = `Based on the following app description and its key features, suggest a high-level technology stack (e.g., Frontend, Backend, Database, Mobile). Focus on common, modern technologies suitable for the described app. Provide the output as a JSON object with keys like "frontend", "backend", "database", "mobile" (each a string or array of strings, or null if not applicable). If a category is not directly relevant, you can omit it or set its value to null/empty array.
        App Description: ${appPreview.description}
        Key Features: ${appPreview.keyFeatures ? appPreview.keyFeatures.join(', ') : 'Not provided'}`;

        const techStackSchema = {
            type: "OBJECT",
            properties: {
                frontend: { type: "STRING" },
                backend: { type: "STRING" },
                database: { type: "STRING" },
                mobile: { type: "STRING" },
                // Add more specific categories if desired, e.g., 'cloudPlatform', 'aiIntegration'
            }
        };

        try {
            const result = await callGeminiApi(techStackPrompt, 'gemini-2.0-flash', techStackSchema);
            if (result) { // Result can be empty object if no tech is suggested
                setTechStackSuggestions(result);
            } else {
                setError("Failed to generate tech stack suggestions. AI response was incomplete or malformed.");
                setTechStackSuggestions(null);
            }
        } finally {
            setIsLoadingTechStack(false);
        }
    };


    // --- JSX Structure ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter text-gray-800 flex items-center justify-center">
            {/* Custom CSS for animations */}
            <style>
                {`
                @keyframes fade-in-down {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
               .animate-fade-in-down {
                    animation: fade-in-down 0.6s ease-out forwards;
                }
               .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }
                `}
            </style>
            <div className="max-w-4xl w-full bg-white shadow-2xl rounded-xl p-8 sm:p-10 border border-blue-200">
                {/* Header Section */}
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-extrabold text-indigo-700 mb-3 animate-fade-in-down">
                        AI App Prompt Enhancer
                    </h1>
                    <p className="text-lg text-gray-600">
                        Turn your simple app idea into a clear, comprehensive prompt and preview!
                    </p>
                </header>

                {/* Simple Idea Input Section */}
                <section className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner border border-blue-100 animate-fade-in">
                    <h2 className="text-2xl font-semibold text-indigo-600 mb-4">1. Your Simple App Idea</h2>
                    <textarea
                        className="w-full p-4 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out resize-y min-h-[100px]"
                        placeholder="e.g., 'A to-do list app with reminders' or 'An app to track my daily water intake'"
                        value={simpleIdea}
                        onChange={(e) => {
                            setSimpleIdea(e.target.value);
                            clearError(); // Clear error when user types
                            setIsPromptEnhanced(false); // Reset enhanced state on new input
                            setAppPreview(null); // Clear preview
                            setEnhancedPrompt(''); // Clear enhanced prompt
                            setCustomPrompt(''); // Clear custom prompt
                            setAppNamesSlogans(null);
                            setMonetizationStrategies(null);
                            setTechStackSuggestions(null);
                        }}
                        rows="4"
                    ></textarea>
                    <button
                        onClick={handleEnhancePrompt}
                        className="mt-4 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg text-lg font-bold hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md active:shadow-sm flex items-center justify-center"
                        disabled={isLoadingEnhance}
                    >
                        {isLoadingEnhance ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Enhancing Prompt...
                            </>
                        ) : (
                            'Enhance Prompt'
                        )}
                    </button>
                </section>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center animate-fade-in" role="alert">
                        {error}
                    </div>
                )}

                {/* Enhanced Prompt Section */}
                {isPromptEnhanced && (
                    <section ref={enhancedPromptRef} className="mb-8 p-6 bg-green-50 rounded-lg shadow-inner border border-green-100 animate-fade-in">
                        <h2 className="text-2xl font-semibold text-green-700 mb-4">2. Enhanced & Customizable Prompt</h2>
                        <p className="text-gray-700 mb-3">
                            Here's the detailed prompt generated from your idea. Feel free to customize it to refine your vision!
                        </p>
                        <textarea
                            className="w-full p-4 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent transition duration-200 ease-in-out resize-y min-h-[250px]"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            rows="10"
                        ></textarea>
                        <button
                            onClick={handleGenerateAppPreview}
                            className="mt-4 w-full bg-teal-600 text-white py-3 px-6 rounded-lg text-lg font-bold hover:bg-teal-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md active:shadow-sm flex items-center justify-center"
                            disabled={isLoadingPreview || !customPrompt.trim()}
                        >
                            {isLoadingPreview ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating Preview...
                                </>
                            ) : (
                                'Generate App Preview'
                            )}
                        </button>
                    </section>
                )}

                {/* App Preview Section */}
                {appPreview && (
                    <section ref={appPreviewRef} className="mb-8 p-6 bg-purple-50 rounded-lg shadow-inner border border-purple-100 animate-fade-in">
                        <h2 className="text-2xl font-semibold text-purple-700 mb-4">3. App Preview</h2>
                        <div className="prose lg:prose-lg max-w-none text-gray-800 bg-white p-5 rounded-lg border border-purple-200">
                            {appPreview.appName && <h3 className="text-xl font-bold text-purple-600 mb-2">{appPreview.appName}</h3>}
                            {appPreview.tagline && <p className="text-md italic text-gray-600 mb-3">"{appPreview.tagline}"</p>}
                            {appPreview.description && <p className="mb-4 whitespace-pre-wrap">{appPreview.description}</p>}

                            {appPreview.keyFeatures && appPreview.keyFeatures.length > 0 && (
                                <>
                                    <h4 className="text-lg font-semibold text-purple-600 mb-2">Key Features:</h4>
                                    <ul className="list-disc list-inside ml-4 mb-4">
                                        {appPreview.keyFeatures.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {appPreview.targetAudience && (
                                <p><strong>Target Audience:</strong> {appPreview.targetAudience}</p>
                            )}
                        </div>

                        {/* Buttons for new functionalities */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={handleGenerateNamesSlogans}
                                className="bg-pink-600 text-white py-3 px-4 rounded-lg text-md font-bold hover:bg-pink-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md flex items-center justify-center"
                                disabled={isLoadingNames}
                            >
                                {isLoadingNames ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Suggest App Names & Slogans ✨'
                                )}
                            </button>

                            <button
                                onClick={handleGenerateMonetizationStrategies}
                                className="bg-orange-600 text-white py-3 px-4 rounded-lg text-md font-bold hover:bg-orange-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md flex items-center justify-center"
                                disabled={isLoadingMonetization}
                            >
                                {isLoadingMonetization ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Brainstorm Monetization ✨'
                                )}
                            </button>

                            <button
                                onClick={handleGenerateTechStack}
                                className="bg-blue-600 text-white py-3 px-4 rounded-lg text-md font-bold hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md flex items-center justify-center"
                                disabled={isLoadingTechStack}
                            >
                                {isLoadingTechStack ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Suggest Tech Stack ✨'
                                )}
                            </button>
                        </div>

                        {/* Display App Names & Slogans */}
                        {appNamesSlogans && (
                            <div className="mt-8 p-5 bg-pink-50 rounded-lg border border-pink-200 animate-fade-in">
                                <h4 className="text-lg font-semibold text-pink-700 mb-3">Suggested Names & Slogans:</h4>
                                {appNamesSlogans.names && appNamesSlogans.names.length > 0 && (
                                    <>
                                        <p className="font-medium text-pink-600">Names:</p>
                                        <ul className="list-disc list-inside ml-4 mb-2 text-gray-800">
                                            {appNamesSlogans.names.map((name, index) => <li key={index}>{name}</li>)}
                                        </ul>
                                    </>
                                )}
                                {appNamesSlogans.taglines && appNamesSlogans.taglines.length > 0 && (
                                    <>
                                        <p className="font-medium text-pink-600 mt-3">Taglines:</p>
                                        <ul className="list-disc list-inside ml-4 text-gray-800">
                                            {appNamesSlogans.taglines.map((tagline, index) => <li key={index}>"{tagline}"</li>)}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Display Monetization Strategies */}
                        {monetizationStrategies && monetizationStrategies.length > 0 && (
                            <div className="mt-8 p-5 bg-orange-50 rounded-lg border border-orange-200 animate-fade-in">
                                <h4 className="text-lg font-semibold text-orange-700 mb-3">Monetization Strategies:</h4>
                                <ul className="list-disc list-inside ml-4 text-gray-800 space-y-2">
                                    {monetizationStrategies.map((strategy, index) => (
                                        <li key={index}>
                                            <strong className="text-orange-600">{strategy.name}:</strong> {strategy.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Display Tech Stack Suggestions */}
                        {techStackSuggestions && (
                            <div className="mt-8 p-5 bg-blue-50 rounded-lg border border-blue-200 animate-fade-in">
                                <h4 className="text-lg font-semibold text-blue-700 mb-3">High-Level Tech Stack Suggestions:</h4>
                                <ul className="list-disc list-inside ml-4 text-gray-800 space-y-1">
                                    {techStackSuggestions.frontend && <li><strong>Frontend:</strong> {techStackSuggestions.frontend}</li>}
                                    {techStackSuggestions.backend && <li><strong>Backend:</strong> {techStackSuggestions.backend}</li>}
                                    {techStackSuggestions.database && <li><strong>Database:</strong> {techStackSuggestions.database}</li>}
                                    {techStackSuggestions.mobile && <li><strong>Mobile Specific:</strong> {techStackSuggestions.mobile}</li>}
                                    {Object.keys(techStackSuggestions).length === 0 && <p>No specific tech stack suggestions at this time.</p>}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* Tips for Better Prompts Section */}
                <section className="p-6 bg-gray-50 rounded-lg shadow-inner border border-gray-100 animate-fade-in">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Tips for Better Prompts</h2>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                        <li>
                            **Be Specific:** Instead of "social media app," try "a social media app for sharing short video clips."
                        </li>
                        <li>
                            **Define Your Audience:** Who is this app for? "Students," "small business owners," "fitness enthusiasts"?
                        </li>
                        <li>
                            **List Key Features:** What are the absolute must-have functionalities? "User authentication," "image upload," "real-time chat."
                        </li>
                        <li>
                            **Consider Platform:** Is it mobile-only, web-only, or both? Specify if it should work on iOS/Android.
                        </li>
                        <li>
                            **Think UI/UX:** Mention desired look and feel. "Minimalist design," "intuitive navigation," "dark mode support."
                        </li>
                        <li>
                            **Add Constraints/Goals:** "Must be highly secure," "needs to scale to millions of users," "monetized through subscriptions."
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default App;
