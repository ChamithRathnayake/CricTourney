import sqlite3
import random
import datetime
import math

db_path = r"c:\Users\chamithr\OneDrive - Trischel Fabric (Pvt) Ltd\Documents\CricketTourney\cricket-backend\pb_data\data.db"

def rand_id():
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "".join(random.choice(chars) for _ in range(15))

def get_now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.000Z")

def get_stage_name(round_num, match_index):
    if round_num == 1: return 'Final'
    if round_num == 2: return f'Semi Final {match_index}'
    if round_num == 3: return f'Quarter Final {match_index}'
    if round_num == 4: return f'Round of 16 - Match {match_index}'
    if round_num == 5: return f'Round of 32 - Match {match_index}'
    return f'Round {round_num} - Match {match_index}'

def main():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Clear existing matches/innings/deliveries
    print("Clearing matches, innings, deliveries...")
    cursor.execute("DELETE FROM deliveries")
    cursor.execute("DELETE FROM innings")
    cursor.execute("DELETE FROM matches")

    # Fetch teams
    cursor.execute("SELECT id, name FROM teams")
    teams = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    N = len(teams)
    print(f"Fetched {N} teams.")

    if N < 2:
        print("At least 2 teams are required.")
        return

    # Find next power of 2
    P = 2
    while P < N:
        P *= 2

    rounds_count = int(math.log2(P))
    print(f"Target power of 2: {P}, Total rounds: {rounds_count}")

    now = get_now()

    # Create empty matches map
    created_matches = {} # (round, match_index) -> (id, stage)
    
    # 1. Create empty matches in SQLite
    for r in range(rounds_count, 0, -1):
        num_matches = 2 ** (r - 1)
        for m in range(1, num_matches + 1):
            m_id = rand_id()
            stage = get_stage_name(r, m)
            cursor.execute(
                "INSERT INTO matches (id, created, updated, stage, status, team1, team2, winner, overs_limit, match_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (m_id, now, now, stage, 'Upcoming', '', '', '', 5, '')
            )
            created_matches[(r, m)] = (m_id, stage)

    print(f"Created {len(created_matches)} matches in the tree.")

    # 2. Shuffle teams
    random.shuffle(teams)

    # 3. Populate first round
    num_matches_r1 = P // 2
    num_real_matches = N - P // 2
    t_index = 0

    print(f"Distributing teams: {num_real_matches} real matches, {num_matches_r1 - num_real_matches} bye matches.")

    for m in range(1, num_matches_r1 + 1):
        m_id, stage = created_matches[(rounds_count, m)]
        if m <= num_real_matches:
            team1_id = teams[t_index]["id"]
            team2_id = teams[t_index + 1]["id"]
            team1_name = teams[t_index]["name"]
            team2_name = teams[t_index + 1]["name"]
            
            cursor.execute(
                "UPDATE matches SET team1 = ?, team2 = ? WHERE id = ?",
                (team1_id, team2_id, m_id)
            )
            print(f"  {stage}: {team1_name} vs {team2_name}")
            t_index += 2
        else:
            # Bye Match
            bye_team_id = teams[t_index]["id"]
            bye_team_name = teams[t_index]["name"]
            
            cursor.execute(
                "UPDATE matches SET team1 = ?, team2 = ?, status = ?, winner = ? WHERE id = ?",
                (bye_team_id, '', 'Completed', bye_team_id, m_id)
            )
            print(f"  {stage}: {bye_team_name} vs BYE (Auto-completed)")
            
            # Promote to Round 2
            target_round = rounds_count - 1
            if target_round >= 1:
                target_match_index = math.ceil(m / 2)
                slot = "team1" if m % 2 != 0 else "team2"
                target_match_id, target_stage = created_matches[(target_round, target_match_index)]
                
                cursor.execute(
                    f"UPDATE matches SET {slot} = ? WHERE id = ?",
                    (bye_team_id, target_match_id)
                )
                print(f"    -> Promoted {bye_team_name} to {target_stage} ({slot})")
            t_index += 1

    conn.commit()
    conn.close()
    print("Bracket setup completed successfully in SQLite database!")

if __name__ == "__main__":
    main()
