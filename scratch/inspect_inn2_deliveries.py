import sqlite3

db_path = '../cricket-backend/pb_data/data.db'

def inspect_deliveries():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    inning_id = 'gbccmx277pahiil'
    cursor.execute("SELECT id, over_number, ball_number, runs, runs_off_bat, extra_type, is_wicket, created FROM deliveries WHERE inning=? ORDER BY created ASC", (inning_id,))
    dels = cursor.fetchall()
    
    print(f"Deliveries for inning {inning_id}:")
    for d in dels:
        print(f"  ID: {d[0]}, Over: {d[1]}, Ball: {d[2]}, Runs: {d[3]}, RunsOffBat: {d[4]}, ExtraType: {d[5]}, IsWicket: {d[6]}, Created: {d[7]}")
        
    conn.close()

if __name__ == "__main__":
    inspect_deliveries()
