interface OpenAiResponsePayload {
  text: string;
  durationMs: number;
  error?: string;
  requestDetails?: any;
  responseData?: any;
}

interface OpenAiMessageContentPartText {
  type: &#39;text&#39;;
  text: string;
}

interface OpenAiMessageContentPartImage {
  type: &#39;image_url&#39;;
  image_url: {
    url: string;
    detail?: &#39;low&#39; | &#39;high&#39; | &#39;auto&#39;;
  };
}

type OpenAiMessageContentPart = OpenAiMessageContentPartText | OpenAiMessageContentPartImage;

interface OpenAiChatMessage {
  role: &#39;system&#39; | &#39;user&#39; | &#39;assistant&#39;;
  content: string | Array&lt;OpenAiMessageContentPart&gt;;
}

export const generateOpenAiResponse = async (
  prompt: string,
  modelId: string,
  apiKey: string,
  baseUrl: string,
  systemInstruction?: string,
  imagePart?: { mimeType: string; data: string }
): Promise&lt;OpenAiResponsePayload&gt; =&gt; {
  const startTime = performance.now();
  const messages: OpenAiChatMessage[] = [];

  if (systemInstruction) {
    messages.push({ role: &#39;system&#39;, content: systemInstruction });
  }

  let userMessageContent: string | Array&lt;OpenAiMessageContentPart&gt;;
  if (imagePart &amp;&amp; imagePart.data) {
    userMessageContent = [
      { type: &#39;text&#39;, text: prompt },
      {
        type: &#39;image_url&#39;,
        image_url: {
          url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
        },
      },
    ];
  } else {
    userMessageContent = prompt;
  }
  messages.push({ role: &#39;user&#39;, content: userMessageContent });

  const requestBody = {
    model: modelId,
    messages: messages,
  };

  const requestDetails = {
    url: `${baseUrl}/chat/completions`,
    method: &#39;POST&#39;,
    headers: {
      &#39;Content-Type&#39;: &#39;application/json&#39;,
      &#39;Authorization&#39;: `Bearer ${apiKey.substring(0, 10)}...`,
    },
    body: requestBody
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: &#39;POST&#39;,
      headers: {
        &#39;Content-Type&#39;: &#39;application/json&#39;,
        &#39;Authorization&#39;: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = performance.now() - startTime;

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // If parsing error body fails, use status text
      }
      
      const errorMessage = errorBody?.error?.message || response.statusText || `请求失败，状态码: ${response.status}`;
      
      let errorType = &quot;OpenAI API error&quot;;
      if (response.status === 401 || response.status === 403) {
        errorType = &quot;API key invalid or permission denied&quot;;
      } else if (response.status === 429) {
        errorType = &quot;Quota exceeded&quot;;
      }
      
      return { text: errorMessage, durationMs, error: errorType, requestDetails, responseData: errorBody };
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      return { text: &quot;AI响应格式无效。&quot;, durationMs, error: &quot;Invalid response structure&quot;, requestDetails, responseData: data };
    }

    const choice = data.choices[0];
    if (!choice.message) {
      return { text: &quot;AI响应消息为空。&quot;, durationMs, error: &quot;Missing message&quot;, requestDetails, responseData: data };
    }

    const content = choice.message.content || &quot;&quot;;
    
    return { text: content, durationMs };

  } catch (error) {
    const durationMs = performance.now() - startTime;
    let errorMessage = &quot;与AI通信时发生未知错误。&quot;;
    let errorType = &quot;Unknown AI error&quot;;
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    return { text: errorMessage, durationMs, error: errorType, requestDetails };
  }
};