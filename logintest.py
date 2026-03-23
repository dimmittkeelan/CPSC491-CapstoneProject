#!/usr/bin/env python3
import json
import sys
from urllib import request, error
from http.cookiejar import CookieJar
from urllib.request import build_opener, HTTPCookieProcessor

BASE_URL = "https://servertest-vq85.onrender.com"


class AuthClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.cookie_jar = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookie_jar))

    def _post(self, path: str, data: dict):
        url = f"{self.base_url}{path}"
        payload = json.dumps(data).encode("utf-8")
        req = request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        return self._send(req)

    def _get(self, path: str):
        url = f"{self.base_url}{path}"
        req = request.Request(url, method="GET")
        return self._send(req)

    def _send(self, req: request.Request):
        try:
            with self.opener.open(req) as resp:
                body = resp.read().decode("utf-8")
                return resp.status, self._parse_body(body)
        except error.HTTPError as e:
            body = e.read().decode("utf-8")
            return e.code, self._parse_body(body)
        except Exception as e:
            return None, {"ok": False, "error": str(e)}

    @staticmethod
    def _parse_body(body: str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return body

    def register(self, email: str, username: str, password: str):
        return self._post(
            "/auth/register",
            {"email": email, "username": username, "password": password},
        )

    def login(self, email: str, password: str):
        return self._post(
            "/auth/login",
            {"email": email, "password": password},
        )

    def me(self):
        return self._get("/auth/me")

    def logout(self):
        return self._post("/auth/logout", {})


def print_result(status, body):
    print(f"\nHTTP {status}")
    if isinstance(body, dict):
        print(json.dumps(body, indent=2))
    else:
        print(body)
    print()


def prompt(text: str) -> str:
    return input(text).strip()


def main():
    base_url = BASE_URL
    if len(sys.argv) > 1:
        base_url = sys.argv[1]

    client = AuthClient(base_url)

    while True:
        print("==== Auth Test CLI ====")
        print(f"Server: {base_url}")
        print("1. Register")
        print("2. Login")
        print("3. Me")
        print("4. Logout")
        print("5. Quit")

        choice = prompt("Choose an option: ")

        if choice == "1":
            email = prompt("Email: ")
            username = prompt("Username (optional): ")
            password = prompt("Password: ")
            status, body = client.register(email, username, password)
            print_result(status, body)

        elif choice == "2":
            email = prompt("Email: ")
            password = prompt("Password: ")
            status, body = client.login(email, password)
            print_result(status, body)

        elif choice == "3":
            status, body = client.me()
            print_result(status, body)

        elif choice == "4":
            status, body = client.logout()
            print_result(status, body)

        elif choice == "5":
            print("Goodbye.")
            break

        else:
            print("Invalid option.\n")


if __name__ == "__main__":
    main()
