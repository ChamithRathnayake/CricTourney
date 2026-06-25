import sqlite3
import random
import string
import datetime

db_path = r"c:\Users\chamithr\OneDrive - Trischel Fabric (Pvt) Ltd\Documents\CricketTourney\cricket-backend\pb_data\data.db"

def rand_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))

def get_now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.000Z")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Clear existing data
cursor.execute("DELETE FROM deliveries")
cursor.execute("DELETE FROM innings")
cursor.execute("DELETE FROM matches")
cursor.execute("DELETE FROM players")
cursor.execute("DELETE FROM teams")
conn.commit()

print("Cleared existing tables.")

# Define 8 teams
team_data = [
    ("Tech Titans", "TET"),
    ("Finance Falcons", "FIF"),
    ("Marketing Mavericks", "MAM"),
    ("Sales Sharks", "SAS"),
    ("HR Hurricanes", "HRH"),
    ("Ops Olympians", "OPO"),
    ("Product Pioneers", "PRP"),
    ("Support Spartans", "SUS")
]

teams = []
now = get_now()

for name, short_name in team_data:
    t_id = rand_id()
    cursor.execute(
        "INSERT INTO teams (id, created, updated, name, short_name, logo) VALUES (?, ?, ?, ?, ?, ?)",
        (t_id, now, now, name, short_name, "")
    )
    teams.append({"id": t_id, "name": name, "short_name": short_name})

print(f"Inserted {len(teams)} teams.")

# Roster generator: 15 players per team
# 6 Batters, 4 Bawlers, 4 All-Rounders, 1 Wicket Keeper
roles = (
    ["Batter"] * 6 +
    ["Bawler"] * 4 +
    ["All-Rounder"] * 4 +
    ["Wicket Keeper"] * 1
)

player_names_pool = [
    "Chamith", "John", "David", "Michael", "James", "Robert", "William", "Joseph",
    "Thomas", "Charles", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven",
    "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George", "Edward",
    "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas",
    "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin",
    "Samuel", "Gregory", "Frank", "Alexander", "Raymond", "Patrick", "Jack", "Dennis",
    "Jerry", "Tyler", "Aaron", "Jose", "Adam", "Nathan", "Henry", "Douglas",
    "Zachary", "Peter", "Kyle", "Walter", "Harold", "Jeremy", "Ethan", "Carl",
    "Keith", "Roger", "Gerald", "Christian", "Terry", "Sean", "Arthur", "Austin",
    "Noah", "Lawrence", "Jesse", "Joe", "Bryan", "Billy", "Jordan", "Albert",
    "Dylan", "Bruce", "Willie", "Alan", "Ralph", "Gabriel", "Roy", "Juan",
    "Wayne", "Eugene", "Logan", "Randy", "Louis", "Vincent", "Russell", "Bobby",
    "Philip", "Johnny", "Bradley", "Howard", "Martin", "Harry", "Zachariah", "Ravi",
    "Arjun", "Mahela", "Kumar", "Lasith", "Sanath", "Muttiah", "Angelo", "Dilshan",
    "Suranga", "Kusal", "Dimuth", "Dinesh", "Wanindu", "Charith", "Pathum", "Lahiru"
]

random.shuffle(player_names_pool)

player_count = 0
for t in teams:
    for idx, role in enumerate(roles):
        p_id = rand_id()
        p_name = f"{player_names_pool[player_count % len(player_names_pool)]} ({t['short_name']}-{idx+1})"
        cursor.execute(
            "INSERT INTO players (id, created, updated, name, role, team) VALUES (?, ?, ?, ?, ?, ?)",
            (p_id, now, now, p_name, role, t["id"])
        )
        player_count += 1

print(f"Inserted {player_count} players.")

# Create 7 Matches
# 4 Quarter Finals
stages = [
    ("Quarter Final 1", teams[0]["id"], teams[1]["id"]),
    ("Quarter Final 2", teams[2]["id"], teams[3]["id"]),
    ("Quarter Final 3", teams[4]["id"], teams[5]["id"]),
    ("Quarter Final 4", teams[6]["id"], teams[7]["id"]),
    ("Semi Final 1", "", ""),
    ("Semi Final 2", "", ""),
    ("Final", "", "")
]

match_count = 0
for stage, team1, team2 in stages:
    m_id = rand_id()
    cursor.execute(
        "INSERT INTO matches (id, created, updated, stage, status, team1, team2, winner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (m_id, now, now, stage, "Upcoming", team1, team2, "")
    )
    match_count += 1

print(f"Inserted {match_count} matches.")

conn.commit()
conn.close()
print("Database seeding completed successfully.")
