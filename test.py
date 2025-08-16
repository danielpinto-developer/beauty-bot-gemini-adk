import csv
import requests
import time
import json

BOT_URL = "https://beauty-bot-gemini-adk.onrender.com"
TEST_FILE = "beautybot_test_scenarios.txt"
OUTPUT_FILE = "test_results_gemini_bot.csv"

def load_test_inputs(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def run_test(phone, message):
    try:
        res = requests.post(BOT_URL, json={"phone": phone, "text": message}, timeout=15)
        try:
            parsed = res.json()
            reply = parsed.get("response", "").replace("\n", " ")
        except json.JSONDecodeError:
            reply = res.text.strip()[:300].replace("\n", " ")

        return res.status_code, reply
    except Exception as e:
        return "ERROR", str(e)

def main():
    test_inputs = load_test_inputs(TEST_FILE)
    phone = "19999999999"

    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Test #", "Input Message", "Status Code", "Gemini Response"])

        for i, input_text in enumerate(test_inputs, start=1):
            status, response = run_test(phone, input_text)
            print(f"[{i:03}] {status} — {input_text}")
            writer.writerow([i, input_text, status, response])
            time.sleep(1.2)

    print(f"\n✅ Done. Results saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
