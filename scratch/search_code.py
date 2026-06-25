import re

def search_file(filepath, pattern):
    print(f"--- Searching in {filepath} for pattern: '{pattern}' ---")
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    compiled = re.compile(pattern, re.IGNORECASE)
    matches = 0
    for idx, line in enumerate(lines):
        if compiled.search(line):
            print(f"{idx+1}: {line.strip()}")
            matches += 1
            if matches >= 100:
                print("... truncated after 100 matches ...")
                break

if __name__ == '__main__':
    search_file('cricket-frontend/src/components/AdminScorer.tsx', r'(runoutCompletedRuns|runoutExtraType|WicketModal|wicketModal|showWicketModal)')
