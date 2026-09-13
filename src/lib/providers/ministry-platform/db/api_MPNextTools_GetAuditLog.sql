/****** Object:  StoredProcedure [dbo].[api_MPNextTools_GetAuditLog]    Script Date: 07/26/2026 ******/
DROP PROCEDURE IF EXISTS [dbo].[api_MPNextTools_GetAuditLog]
GO

/****** Object:  StoredProcedure [dbo].[api_MPNextTools_GetAuditLog]    Script Date: 07/26/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- api_MPNextTools_GetAuditLog
-- =============================================
-- Description: Returns audit log entries and their field-level detail for a
--              single record, joined from dp_Audit_Log and dp_Audit_Detail.
--              Optional filters: date range, acting user, field, and row cap.
--              One flat row per changed field; entries with no detail rows
--              still return a single row with NULL field columns (LEFT JOIN),
--              except when @FieldName is supplied.
-- Last Modified: 07/26/2026
-- Chris Kehayias
-- =============================================
CREATE PROCEDURE [dbo].[api_MPNextTools_GetAuditLog]
    @DomainID INT,                      -- Required by the MP API; dp_Audit_Log is not domain-scoped
    @TableName VARCHAR(75),
    @RecordID INT,
    @StartDate DATETIME = NULL,         -- Inclusive lower bound on dp_Audit_Log.Date_Time
    @EndDate DATETIME = NULL,           -- Inclusive upper bound on dp_Audit_Log.Date_Time
    @AuditUserID INT = NULL,            -- Only entries made by this dp_Users.User_ID; NULL = all users
    @FieldName NVARCHAR(50) = NULL,     -- Only changes to this field (matches Field_Name or Field_Label); NULL = all fields
    @MaxItems INT = NULL                -- Cap on audit ITEMS (not detail rows); NULL = all
AS
BEGIN
    SET NOCOUNT ON;

    IF @TableName IS NULL OR LTRIM(RTRIM(@TableName)) = ''
    BEGIN
        RAISERROR('@TableName is required.', 16, 1);
        RETURN;
    END

    IF @RecordID IS NULL
    BEGIN
        RAISERROR('@RecordID is required.', 16, 1);
        RETURN;
    END

    -- Treat an all-whitespace field filter as "no filter"
    IF LTRIM(RTRIM(ISNULL(@FieldName, ''))) = ''
        SET @FieldName = NULL;

    -- Resolve the matching audit items first so @MaxItems limits entries,
    -- not the detail rows that hang off them.
    DECLARE @Top INT = ISNULL(@MaxItems, 2147483647);

    DECLARE @Items TABLE (Audit_Item_ID INT PRIMARY KEY);

    INSERT INTO @Items (Audit_Item_ID)
    SELECT TOP (@Top) al.Audit_Item_ID
    FROM dp_Audit_Log al
    WHERE al.Table_Name = @TableName
      AND al.Record_ID = @RecordID
      AND (@StartDate IS NULL OR al.Date_Time >= @StartDate)
      AND (@EndDate IS NULL OR al.Date_Time <= @EndDate)
      AND (@AuditUserID IS NULL OR al.User_ID = @AuditUserID)
      -- With a field filter, drop entries that never touched that field
      -- (including create/delete entries that carry no detail rows).
      AND (@FieldName IS NULL OR EXISTS (
              SELECT 1
              FROM dp_Audit_Detail d
              WHERE d.Audit_Item_ID = al.Audit_Item_ID
                AND (d.Field_Name = @FieldName OR d.Field_Label = @FieldName)
          ))
    ORDER BY al.Date_Time DESC, al.Audit_Item_ID DESC;

    SELECT
        al.Audit_Item_ID,
        al.Table_Name,
        al.Record_ID,
        al.Audit_Description,
        al.Date_Time,
        al.User_ID,
        al.User_Name,
        al.On_Behalf_Of_User_ID,
        al.On_Behalf_Of_User_Name,
        al.Impersonated_By_User_ID,
        al.Impersonated_By_User_Name,
        ad.Audit_Detail_ID,
        ad.Field_Name,
        ad.Field_Label,
        ad.Previous_Value,
        ad.New_Value,
        ad.Previous_ID,
        ad.New_ID
    FROM dp_Audit_Log al
    INNER JOIN @Items i ON i.Audit_Item_ID = al.Audit_Item_ID
    LEFT JOIN dp_Audit_Detail ad
           ON ad.Audit_Item_ID = al.Audit_Item_ID
          AND (@FieldName IS NULL OR ad.Field_Name = @FieldName OR ad.Field_Label = @FieldName)
    ORDER BY al.Date_Time DESC,
             al.Audit_Item_ID DESC,
             ISNULL(ad.Field_Label, ad.Field_Name),
             ad.Audit_Detail_ID;

END
GO

-- =============================================
-- SP MetaData Install
-- =============================================
DECLARE @spName NVARCHAR(128) = 'api_MPNextTools_GetAuditLog';
DECLARE @spDescription NVARCHAR(500) = 'Returns audit log entries and field-level detail for a single record, filtered by table name and record ID, with optional date range, acting user, and field filters';

IF NOT EXISTS (
    SELECT API_Procedure_ID FROM dp_API_Procedures WHERE Procedure_Name = @spName
)
BEGIN
    INSERT INTO dp_API_Procedures (Procedure_Name, Description)
    VALUES (@spName, @spDescription);
END

-- Grant to Administrators Role
DECLARE @AdminRoleID INT = (
    SELECT Role_ID FROM dp_Roles WHERE Role_Name = 'Administrators'
);

IF NOT EXISTS (
    SELECT 1
    FROM dp_Role_API_Procedures RP
    INNER JOIN dp_API_Procedures AP ON AP.API_Procedure_ID = RP.API_Procedure_ID
    WHERE AP.Procedure_Name = @spName AND RP.Role_ID = @AdminRoleID
)
BEGIN
    INSERT INTO dp_Role_API_Procedures (Domain_ID, API_Procedure_ID, Role_ID)
    VALUES (
        1,
        (SELECT API_Procedure_ID FROM dp_API_Procedures WHERE Procedure_Name = @spName),
        @AdminRoleID
    );
END
GO
