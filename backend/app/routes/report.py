# backend/app/routes/report.py
from fastapi import APIRouter, HTTPException, Depends
from app.services.report_service import (
    generate_case_report,
    get_reports_for_case,
    delete_report_from_db,
)
from app.routes.auth import get_current_user
import traceback

router = APIRouter()


@router.get("/cases/{case_id}/report")
async def get_case_report(case_id: int, current_user: dict = Depends(get_current_user)):
    """Generate a new AI forensic report and save it to the database"""
    try:
        report = generate_case_report(case_id, user_id=current_user["id"])
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("=" * 60)
        print("REPORT GENERATION ERROR:")
        traceback.print_exc()
        print("=" * 60)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/cases/{case_id}/reports")
async def list_case_reports(case_id: int, current_user: dict = Depends(get_current_user)):
    """Get all saved reports for a case"""
    try:
        reports = get_reports_for_case(case_id)
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")


@router.delete("/reports/{report_id}")
async def delete_case_report(report_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a saved report by id"""
    try:
        deleted = delete_report_from_db(report_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"message": "Report deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")