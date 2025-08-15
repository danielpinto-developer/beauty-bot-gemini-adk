import csv
import requests
import time

# Endpoint of your deployed bot
BOT_URL = "https://beauty-bot-gemini-adk.onrender.com"
TEST_FILE = "beautybot_test_scenarios.txt"
OUTPUT_FILE = "test_results_gemini_bot.csv"

def load_test_inputs(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def run_test(phone, message):
    try:
        res = requests.post(BOT_URL, json={"phone": phone, "text": message}, timeout=15)
        if res.status_code == 200:
            return 200, res.text.strip()
        else:
            return res.status_code, res.text.strip()
    except Exception as e:
        return "ERROR", str(e)

def main():
    test_inputs = load_test_inputs(TEST_FILE)
    phone = "19999999999"  # Dummy test phone

    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Test #", "Input Message", "Status Code", "Gemini Response"])

        for i, input_text in enumerate(test_inputs, start=1):
            status, response = run_test(phone, input_text)
            print(f"[{i:03}] {status} — {input_text}")

            # Try to extract the "response" field from Gemini's JSON
            message = ""
            try:
                json_start = response.find('{')
                json_text = response[json_start:]
                parsed = eval(json_text)  # You could also use json.loads if formatted safely
                message = parsed.get("response", "")[:300].replace("\n", " ")
            except:
                message = response[:300].replace("\n", " ")

            writer.writerow([i, input_text, status, message])
            time.sleep(1.2)  # Add slight delay to avoid overloading the bot

    print(f"\n✅ Done. Results saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
