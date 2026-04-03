FROM python:3.9-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential psmisc netcat-openbsd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements.txt

RUN pip3 install -r requirements.txt

COPY . .

WORKDIR /app/wechat-spider

EXPOSE 8080
EXPOSE 8081

# ENTRYPOINT [ "python3", "./run.py" ]

CMD [ "python3", "./run.py" ]
