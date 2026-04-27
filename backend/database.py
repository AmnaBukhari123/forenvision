import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv() 


DB_HOST = os.getenv("DB_HOST", "DB_HOST")
DB_NAME = os.getenv("DB_NAME", "DB_NAME")
DB_USER = os.getenv("DB_USER", "DB_USER")
DB_PASS = os.getenv("DB_PASSWORD")

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        cursor_factory=RealDictCursor
    )