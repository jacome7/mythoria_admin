import asyncio
import argparse
from contextlib import AsyncExitStack

async def main():
    parser = argparse.ArgumentParser(description="Test Mythoria Admin MCP Server using SSE")
    parser.add_argument("--url", default="https://admin.mythoria.com/api/mcp", help="The URL of the MCP SSE endpoint (e.g., https://admin.mythoria.com/api/mcp)")
    parser.add_argument("--token", required=True, help="The Bearer token (MCP_SECRET_KEY)")
    
    args = parser.parse_args()
    
    headers = {
        "Authorization": f"Bearer {args.token}"
    }

    print(f"Attempting to connect to MCP Server at: {args.url}")
    
    try:
        from mcp import ClientSession
        from mcp.client.sse import sse_client
        import httpx
    except ImportError:
        print("Error: The 'mcp' Python SDK is not installed.")
        print("Please run: pip install mcp httpx")
        return

    try:
        async with AsyncExitStack() as stack:
            # Initialize SSE connection with the Authorization header
            read_stream, write_stream = await stack.enter_async_context(
                sse_client(url=args.url, headers=headers)
            )
            print("SSE Connection established.")
            
            # Start the client session
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            
            print("Initializing session...")
            await session.initialize()
            print("Session initialized successfully!")
            
            # Fetch tools
            print("Fetching available tools...")
            tools_response = await session.list_tools()
            
            print("\n---------- Available Tools ----------")
            for tool in tools_response.tools:
                print(f"🧰 {tool.name}")
                print(f"   Description: {tool.description}")
                print(f"   Input Schema: {tool.inputSchema}")
                print("-------------------------------------")
                
            # Fetch prompts (optional, if any exist)
            try:
                prompts_response = await session.list_prompts()
                if prompts_response.prompts:
                    print("\n---------- Available Prompts ----------")
                    for p in prompts_response.prompts:
                        print(f"💬 {p.name}: {p.description}")
            except Exception:
                pass # Server might not support prompts
                
            print("\nMCP Connection Test completed successfully! 🎉")
            
    except httpx.HTTPStatusError as e:
        print(f"\n❌ HTTP Error: {e.response.status_code} - {e.response.text}")
        if e.response.status_code == 401:
            print("-> This indicates an authentication failure. Check if your token is exactly matching MCP_SECRET_KEY.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n❌ Failed to connect or initialize: {e}")

if __name__ == "__main__":
    # Workaround for Windows environments throwing warnings with ProactorEventLoop
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    asyncio.run(main())
