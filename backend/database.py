import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "DB_HOST")
DB_NAME = os.getenv("DB_NAME", "DB_NAME")
DB_USER = os.getenv("DB_USER", "DB_USER")
DB_PASS = os.getenv("DB_PASSWORD")

connection_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=20,
    host=DB_HOST,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASS,
    cursor_factory=RealDictCursor
)

def get_connection():
    return connection_pool.getconn()

def release_connection(conn):
    connection_pool.putconn(conn)

def close_all_connections():
    connection_pool.closeall()