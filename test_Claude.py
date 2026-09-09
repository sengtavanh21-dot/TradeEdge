import os
from dotenv import load_dotenv
import anthropic

load_dotenv()

client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

message = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=5000,
    messages=[
        {"role": "user", "content": "Tell me a brief history on why LAOS and THAILAND have had a similar culture and language."}
    ]
)

print(message.content[0].text)
print(message.stop_reason)
print(message.usage)
print(message.id)
