import os
from dotenv import load_dotenv
import anthropic

load_dotenv()

client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

message = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1000,
    messages=[
        {"role": "user", "content": "Say hello and introduce yourself in a couple of sentences."}
    ]
)

print(message.content[0].text)
