variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "ipad-cidyt"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "firebase_hosting_site" {
  description = "Firebase Hosting site name"
  type        = string
  default     = "ipad-cidyt"
}
