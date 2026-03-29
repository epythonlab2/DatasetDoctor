import typer
import uvicorn

app = typer.Typer()


@app.command()
def dashboard():

    uvicorn.run(
        "datasetdoctor.dashboard.server:app",
        host="127.0.0.1",
        port=8000
    )


if __name__ == "__main__":
    app()