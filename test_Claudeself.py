import os 
from dotenv import load_dotenv
import anthropic

load_dotenv()

client= anthropic.Anthropic (api_key=os.environ.get("ANTHROPIC_API_KEY"))

message=client.messages.create(model="claude-opus-4-8", max_tokens=1000, messages=[{"role":"user", "content":"Briefly tell me why would some people says that sleeping late is good for life."}
])

print(message.content[0].text)
print(message.stop_reason)
print(message.usage)
print(message.id)