#!/bin/bash

# Upload sample DICOM data to local Orthanc server
# This script downloads a sample DICOM file from the public UCLouvain demo
# and uploads it to the local Orthanc instance

set -e

ORTHANC_URL="${ORTHANC_URL:-http://localhost:8042}"
TEMP_DIR="/tmp/dicom-samples"
SAMPLE_INSTANCE_ID="001a7d82-54008387-7b23ad57-8fb6202a-6d3b305b"

echo "=== Uploading Sample DICOM Data to Orthanc ==="
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"

# Download sample DICOM file
echo "1. Downloading sample DICOM file from UCLouvain demo server..."
curl -s "https://orthanc.uclouvain.be/demo/instances/$SAMPLE_INSTANCE_ID/file" \
  -o "$TEMP_DIR/sample001.dcm"

if [ -f "$TEMP_DIR/sample001.dcm" ]; then
  FILE_SIZE=$(ls -lh "$TEMP_DIR/sample001.dcm" | awk '{print $5}')
  echo "   ✓ Downloaded sample001.dcm ($FILE_SIZE)"
else
  echo "   ✗ Failed to download DICOM file"
  exit 1
fi

echo ""

# Check if Orthanc is running
echo "2. Checking if Orthanc is running at $ORTHANC_URL..."
if curl -s "$ORTHANC_URL/system" > /dev/null 2>&1; then
  echo "   ✓ Orthanc is accessible"
else
  echo "   ✗ Orthanc is not accessible at $ORTHANC_URL"
  echo "   Please start Orthanc with: docker compose up -d"
  exit 1
fi

echo ""

# Upload to local Orthanc
echo "3. Uploading to local Orthanc..."
RESPONSE=$(curl -s -X POST "$ORTHANC_URL/instances" \
  -H "Content-Type: application/dicom" \
  --data-binary "@$TEMP_DIR/sample001.dcm")

# Parse response
INSTANCE_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ID', ''))" 2>/dev/null || echo "")
STUDY_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ParentStudy', ''))" 2>/dev/null || echo "")
STATUS=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('Status', ''))" 2>/dev/null || echo "")

if [ "$STATUS" = "Success" ]; then
  echo "   ✓ Upload successful"
  echo "   Instance ID: $INSTANCE_ID"
  echo "   Study ID: $STUDY_ID"
else
  echo "   ✗ Upload failed"
  echo "   Response: $RESPONSE"
  exit 1
fi

echo ""

# Get StudyInstanceUID
echo "4. Getting StudyInstanceUID..."
STUDY_UID=$(curl -s "$ORTHANC_URL/studies/$STUDY_ID" | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['MainDicomTags']['StudyInstanceUID'])" 2>/dev/null || echo "")

if [ -n "$STUDY_UID" ]; then
  echo "   ✓ StudyInstanceUID: $STUDY_UID"
else
  echo "   ✗ Failed to retrieve StudyInstanceUID"
  exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now test the API with:"
echo ""
echo "  curl http://localhost:3000/api/case-bundle/$STUDY_UID"
echo ""
echo "Or view in Orthanc web UI:"
echo ""
echo "  http://localhost:8042/app/explorer.html"
echo ""
