let errorMessage = `[${senderForStep} - ${stepIdentifier}] 调用失败，重试 (${autoRetryCount + 1}/${MAX_AUTO_RETRIES})... ${error.message}`;
if (result?.requestDetails) {
  errorMessage += `\n请求详情: ${JSON.stringify(result.requestDetails, null, 2)}`;
}
addMessage(errorMessage, MessageSender.System, MessagePurpose.SystemNotification);