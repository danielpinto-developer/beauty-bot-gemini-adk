import csv
import requests
import time
import json

# Your deployed bot endpoint
BOT_URL = "https://beauty-bot-gemini-adk.onrender.com"
TEST_FILE = "beautybot_test_scenarios.txt"
OUTPUT_FILE = "test_results_gemini_bot.csv"

def load_test_inputs(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def run_test(phone, message):
    try:
        res = requests.post(BOT_URL, json={"phone": phone, "text": message}, timeout=15)
        return res.status_code, res.text.strip()
    except Exception as e:
        return "ERROR", str(e)

def extract_response_text(raw_text):
    try:
        parsed = json.loads(raw_text)
        return parsed.get("response", "").strip().replace("\n", " ")
    except Exception as e:
        return f"JSON ERROR: {str(e)} - Raw: {raw_text[:300].replace('\n', ' ')}"

def main():
    test_inputs = load_test_inputs(TEST_FILE)
    phone = "19999999999"  # Dummy test number

    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Test #", "Input Message", "Status Code", "Gemini Response"])

        for i, input_text in enumerate(test_inputs, start=1):
            status, response = run_test(phone, input_text)
            print(f"[{i:03}] {status} — {input_text}")

            extracted = extract_response_text(response)
            writer.writerow([i, input_text, status, extracted])
            time.sleep(1.2)

    print(f"\n✅ Done. Results saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
