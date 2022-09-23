import json
import requests
import sys

from os.path import basename
from time import sleep
from typing import Optional, Tuple
from urllib.parse import urljoin

# Type alias for transcoding job status
JobStatus = Tuple[str, Optional[str]]


def login(host: str, username: str, password: str) -> Optional[str]:
    """Attempts to retrieve a login token using username and password."""
    url = urljoin(host, "/api/login")

    # Send login request
    res = requests.post(url, headers={
        "Content-Type": "application/json"
    }, data=json.dumps({
        "username": username,
        "password": password
    }))

    # Return token is request was successful
    if res.ok:
        data = res.json()
        return data["token"]

    return None


def upload_file(host: str, token: str, file_path: str) -> Optional[str]:
    """Uploads a file given by its path."""
    url = urljoin(host, "/api/upload/raw")

    # Send upload request with the given file
    res = requests.post(url, headers={
        "Authorization": f"Bearer {token}"
    }, files={
        "file": (basename(file_path), open(file_path, "rb"))
    })

    # Return path of uploaded file if successful
    if res.ok:
        data = res.json()
        return data["name"]

    return None


def start_transcoding_job(host: str, token: str, input: str) -> Optional[str]:
    """Starts a new transcoding job for the given input."""
    url = urljoin(host, "/api/upload/encode")

    # Send request to start transcoding job with resolutions 480p and 360p
    res = requests.post(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }, data=json.dumps({
        "input": input,
        "resolutions": ["480p", "360p"]
    }))

    # Return job ID if successful
    if res.ok:
        data = res.json()
        return data["jobId"]

    return None


def check_job_status(host: str, token: str, job_id: str) -> JobStatus:
    """Checks the job status for a job with the given ID."""
    url = urljoin(host, f"/api/upload/encode/status/{job_id}")

    # Send request to check status of job with the given ID
    res = requests.get(url, headers={
        "Authorization": f"Bearer {token}"
    })

    if res.ok:
        data = res.json()

        # Return status and manifest path if status is 'Complete'
        if data["jobStatus"] == "Complete":
            return data["jobStatus"], data["manifest"]
        else:
            # Return just job status
            return data["jobStatus"], None

    # Return string 'Exception' if request failed
    return "Exception", None


def delete_uploaded_file(host: str, token: str, key: str) -> bool:
    """Deletes a previously uploaded file."""
    url = urljoin(host, "/api/upload/raw")

    # Send delete request for given key
    res = requests.delete(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }, data=json.dumps({
        "key": key
    }))

    # Return true if request was successful
    if res.ok:
        return True

    return False


def main(host: str, username: str, password: str, file_path: str):
    # Attempt login with username and password
    token = login(host, username, password)

    if token is None:
        print("Login invalid")
        sys.exit(1)

    print("Login successful")

    # Upload file
    uploaded_path = upload_file(host, token, file_path)

    if uploaded_path is None:
        print("Upload failed")
        sys.exit(1)

    print("File uploaded")

    # If file is either *.mov or *.mp4, start transcoding job
    if file_path.endswith("mov") or file_path.endswith("mp4"):
        # Start transcoding job
        job_id = start_transcoding_job(host, token, uploaded_path)

        if job_id is None:
            print("Could not start transcoding job")
            sys.exit(1)

        print("Transcoding job started")

        # Repeatedly check job status
        while True:
            status, manifest = check_job_status(host, token, job_id)
            print("Job status:", status)

            # Exit loop if transcoding job has finished progressing
            if status not in ["Submitted", "Progressing"]:
                break

            # Wait 1 second before sending next request
            sleep(1)

        # Print manifest path if job exitedb successfully
        if status == "Complete":
            print("Manifest generated at:", manifest)
        else:
            # Just print status
            print("Job exited with status:", status)

    # Delete uploaded file
    result = delete_uploaded_file(host, token, uploaded_path)

    if result:
        print("Original file deleted")
    else:
        print("Could not delete original file")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("USAGE:", sys.argv[0], "host username password file")
        sys.exit(1)

    main(*sys.argv[1:5])
