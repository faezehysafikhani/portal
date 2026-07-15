using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.AI;

public class AiProviderSetting : BaseEntity
{
    public string ProviderName { get; set; } = "Groq";
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1";
    public string EncryptedApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "qwen/qwen3-32b";
    public int MaxTokens { get; set; } = 1200;
    public double Temperature { get; set; } = 0.3;
    public string SystemPrompt { get; set; } = "همیشه فارسی، دقیق، کوتاه و ساختارمند پاسخ بده.";
    public bool IsActive { get; set; }
}

public class AiConversation : BaseEntity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = "گفتگوی جدید";
    public ICollection<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
}

public class AiChatMessage : BaseEntity
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
    public int? PromptTokens { get; set; }
    public int? CompletionTokens { get; set; }
    public AiConversation Conversation { get; set; } = null!;
}
