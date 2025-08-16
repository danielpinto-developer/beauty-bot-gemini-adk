import csv
import requests
import time
import json

# Endpoint of your deployed Gemini bot
BOT_URL = "https://beauty-bot-gemini-adk.onrender.com"
TEST_FILE = "beautybot_test_scenarios.txt"
OUTPUT_FILE = "test_results_gemini_bot.csv"

def load_test_inputs(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def run_test(phone, message):
    try:
        res = requests.post(BOT_URL, json={"phone": phone, "text": message}, timeout=20)
        if res.status_code == 200:
            return 200, res.text
        else:
            return res.status_code, res.text
    except Exception as e:
        return "ERROR", str(e)

def extract_message_from_response(response):
    try:
        parsed = json.loads(response)
        return parsed.get("response", "NO RESPONSE").replace("\n", " ")[:300]
    except Exception as e:
        return f"JSON ERROR: {str(e)} - Raw: {response[:300]}"

def main():
    test_inputs = load_test_inputs(TEST_FILE)
    phone = "19999999999"  # Dummy test phone number

    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Test #", "Input Message", "Status Code", "Gemini Response"])

        for i, input_text in enumerate(test_inputs, start=1):
            status, raw_response = run_test(phone, input_text)
            parsed_response = extract_message_from_response(raw_response)
            print(f"[{i:03}] {status} — {input_text} → {parsed_response}")
            writer.writerow([i, input_text, status, parsed_response])
            time.sleep(1.2)  # prevent flooding

    print(f"\n✅ Done. Results saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
