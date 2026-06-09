# Remote backend using GCS
# Create the bucket manually first:
#   gsutil mb -p ipad-cidyt -l us-central1 gs://ipad-cidyt-tfstate
terraform {
  backend "gcs" {
    bucket = "ipad-cidyt-tfstate"
    prefix = "terraform/state"
  }
}
