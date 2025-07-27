
ALTER TRIGGER [dbo].[trg_tblTraceabilityData_AutoPopulate]
ON [FTS Traceability].[dbo].[tblTraceabilityData]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Update the inserted records with lookup values
    UPDATE t
    SET 
        Machine_Name = ISNULL(m.Machine_Name, ''),
        Model_Name = ISNULL(p.Model_Name, ''),
        Part_No = ISNULL(p.Part_No, ''),
        Alarm_Message = CASE 
                           WHEN t.Alarm_No IS NOT NULL THEN ISNULL(a.Alarm_Message, '')
                           ELSE NULL
                       END
    FROM [FTS Traceability].[dbo].[tblTraceabilityData] t
    LEFT JOIN [FTS Traceability].[dbo].[tblMachineMst] m ON t.Machine_No = m.Machine_No AND t.Line_No = m.Line_No
    LEFT JOIN [FTS Traceability].[dbo].[tblPartMst] p ON t.Kind_No = p.Kind_No AND t.Model_No = p.Model_No
    LEFT JOIN [FTS Traceability].[dbo].[tblAlarmMst] a ON t.Machine_No = a.Machine_No AND t.Line_No = a.Line_No AND t.Alarm_No = a.Alarm_No
    INNER JOIN inserted i ON t.LogID = i.LogID
    -- Set Status to 'Complete' if Summary is OK, 'Warning' if NG, when all machines are filled (rework support)
    -- DATA_Code1, DATA_Code2, DATA_Code3 are part of the job's primary key and must be included in all job separation logic
    UPDATE plo
    SET Status = 
        CASE 
            WHEN Summary = 'OK' THEN 'Complete'
            WHEN Summary = 'NG' THEN 'Warning'
            ELSE Status
        END
    FROM [dbo].[ProcessLineOverview] plo
    WHERE NOT EXISTS (
        SELECT 1
        FROM [FTS Traceability].[dbo].[tblMachineMst] m
        WHERE m.Line_No = plo.Line_No
          AND (
            CASE m.Machine_No
                WHEN 1 THEN plo.Machine_1
                WHEN 2 THEN plo.Machine_2
                WHEN 3 THEN plo.Machine_3
                WHEN 4 THEN plo.Machine_4
                WHEN 5 THEN plo.Machine_5
                WHEN 6 THEN plo.Machine_6
                WHEN 7 THEN plo.Machine_7
                WHEN 8 THEN plo.Machine_8
                WHEN 9 THEN plo.Machine_9
                WHEN 10 THEN plo.Machine_10
                WHEN 11 THEN plo.Machine_11
                WHEN 12 THEN plo.Machine_12
                WHEN 13 THEN plo.Machine_13
                WHEN 14 THEN plo.Machine_14
            END
          ) IS NULL
    );

-- AND ISNULL(plo.DATA_Code1, '') <> ''
-- AND ISNULL(plo.DATA_Code2, '') <> ''
-- AND ISNULL(plo.DATA_Code3, '') <> ''
    -- DATA_Code1, DATA_Code2, DATA_Code3 are part of the job's primary key
    -- FROM [FTS Traceability].[dbo].[tblTraceabilityData] t
    -- INNER JOIN inserted i ON t.LogID = i.LogID
    -- LEFT JOIN [FTS Traceability].[dbo].[tblMachineMst] m ON t.Machine_No = m.Machine_No AND t.Line_No = m.Line_No
    -- LEFT JOIN [FTS Traceability].[dbo].[tblPartMst] p ON t.Kind_No = p.Kind_No AND t.Model_No = p.Model_No
    -- LEFT JOIN [FTS Traceability].[dbo].[tblAlarmMst] a ON t.Machine_No = a.Machine_No AND t.Line_No = a.Line_No AND t.Alarm_No = a.Alarm_No

    -- Insert into ProcessOverview
    INSERT INTO [dbo].[ProcessOverview] (
        Machine_No, Machine_Name, Start_Process_Dt, End_Process_Dt, Line_No, Model_No, Kind_No, Model_Name, Part_No,
        DATA_Code1, DATA_Code2, DATA_Code3,
        Process_1, Process_2, Process_3, Process_4, Process_5, Process_6, Process_7, Process_8, Process_9, Process_10, Summary
    )
    SELECT
        i.Machine_No,
        m.Machine_Name,
        i.Start_Process_Dt,
        i.End_Process_Dt,
        i.Line_No,
        i.Model_No,
        i.Kind_No,
        p.Model_Name,
        p.Part_No,
        i.DATA_Code1,
        i.DATA_Code2,
        i.DATA_Code3,
        i.Result1, i.Result2, i.Result3, i.Result4, i.Result5, -- Process_1 to Process_5
        NULL, NULL, NULL, NULL, NULL, -- Process_6 to Process_10
        CASE
            WHEN 
                (UPPER(ISNULL(i.Result1, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result2, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result3, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result4, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result5, '')) = 'NG')
            THEN 'NG'
            WHEN 
                (UPPER(ISNULL(i.Result1, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result2, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result3, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result4, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result5, '')) = 'OK')
            THEN 'OK'
            ELSE NULL
        END -- Summary
    FROM inserted i
    LEFT JOIN [FTS Traceability].[dbo].[tblMachineMst] m ON i.Machine_No = m.Machine_No AND i.Line_No = m.Line_No
    LEFT JOIN [FTS Traceability].[dbo].[tblPartMst] p ON i.Model_No = p.Model_No AND i.Kind_No = p.Kind_No

    -- Insert or update ProcessLineOverview for Machine_No = 1 (first machine for the line)
    -- If a row exists for the same Line_No, Model_No, Kind_No, DATA_Code1-3, update it (rework), else insert
    MERGE [dbo].[ProcessLineOverview] AS target
    USING (
        SELECT
            i.Line_No,
            m.Line_Name,
            i.Model_No,
            i.Kind_No,
            p.Model_Name,
            p.Part_No,
            i.DATA_Code1,
            i.DATA_Code2,
            i.DATA_Code3,
            i.Start_Process_Dt,
            i.End_Process_Dt,
            CASE
                WHEN 
                    (UPPER(ISNULL(i.Result1, '')) = 'NG' OR
                     UPPER(ISNULL(i.Result2, '')) = 'NG' OR
                     UPPER(ISNULL(i.Result3, '')) = 'NG' OR
                     UPPER(ISNULL(i.Result4, '')) = 'NG' OR
                     UPPER(ISNULL(i.Result5, '')) = 'NG')
                THEN 'NG'
                WHEN 
                    (UPPER(ISNULL(i.Result1, '')) = 'OK' OR
                     UPPER(ISNULL(i.Result2, '')) = 'OK' OR
                     UPPER(ISNULL(i.Result3, '')) = 'OK' OR
                     UPPER(ISNULL(i.Result4, '')) = 'OK' OR
                     UPPER(ISNULL(i.Result5, '')) = 'OK')
                THEN 'OK'
                ELSE NULL
            END AS Machine1Summary
        FROM inserted i
        LEFT JOIN [dbo].[tblMachineMst] m ON i.Machine_No = m.Machine_No AND i.Line_No = m.Line_No
        LEFT JOIN [FTS Traceability].[dbo].[tblPartMst] p ON i.Model_No = p.Model_No AND i.Kind_No = p.Kind_No
        WHERE i.Machine_No = 1
    ) AS src
    ON target.Line_No = src.Line_No
       AND target.Model_No = src.Model_No
       AND target.Kind_No = src.Kind_No
       AND ISNULL(target.DATA_Code1, '') = ISNULL(src.DATA_Code1, '')
       AND ISNULL(target.DATA_Code2, '') = ISNULL(src.DATA_Code2, '')
       AND ISNULL(target.DATA_Code3, '') = ISNULL(src.DATA_Code3, '')
    WHEN MATCHED THEN
        UPDATE SET
            target.Machine_1 = src.Machine1Summary,
            target.Start_Process_Dt = src.Start_Process_Dt,
            target.End_Process_Dt = src.End_Process_Dt,
            target.Model_Name = src.Model_Name,
            target.Part_No = src.Part_No
    WHEN NOT MATCHED THEN
        INSERT (
            Line_No, Line_Name, Model_No, Kind_No, Model_Name, Part_No,
            DATA_Code1, DATA_Code2, DATA_Code3, Status, Summary,
            Start_Process_Dt, End_Process_Dt,
            Machine_1, Machine_2, Machine_3, Machine_4, Machine_5, Machine_6, Machine_7, Machine_8, Machine_9, Machine_10, Machine_11, Machine_12, Machine_13, Machine_14
        )
        VALUES (
            src.Line_No, src.Line_Name, src.Model_No, src.Kind_No, src.Model_Name, src.Part_No,
            src.DATA_Code1, src.DATA_Code2, src.DATA_Code3, NULL, NULL,
            src.Start_Process_Dt, src.End_Process_Dt,
            src.Machine1Summary, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        );

    -- After rework/insert, always recalculate summary and status for the affected row
    UPDATE plo
    SET 
        Summary = CASE
            WHEN NOT EXISTS (
                SELECT 1
                FROM [FTS Traceability].[dbo].[tblMachineMst] m
                WHERE m.Line_No = plo.Line_No
                  AND (
                        CASE m.Machine_No
                            WHEN 1 THEN plo.Machine_1
                            WHEN 2 THEN plo.Machine_2
                            WHEN 3 THEN plo.Machine_3
                            WHEN 4 THEN plo.Machine_4
                            WHEN 5 THEN plo.Machine_5
                            WHEN 6 THEN plo.Machine_6
                            WHEN 7 THEN plo.Machine_7
                            WHEN 8 THEN plo.Machine_8
                            WHEN 9 THEN plo.Machine_9
                            WHEN 10 THEN plo.Machine_10
                            WHEN 11 THEN plo.Machine_11
                            WHEN 12 THEN plo.Machine_12
                            WHEN 13 THEN plo.Machine_13
                            WHEN 14 THEN plo.Machine_14
                        END IS NULL
                  )
            )
            THEN
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM [FTS Traceability].[dbo].[tblMachineMst] m2
                        WHERE m2.Line_No = plo.Line_No
                          AND RTRIM(LTRIM(UPPER(
                                CASE m2.Machine_No
                                    WHEN 1 THEN plo.Machine_1
                                    WHEN 2 THEN plo.Machine_2
                                    WHEN 3 THEN plo.Machine_3
                                    WHEN 4 THEN plo.Machine_4
                                    WHEN 5 THEN plo.Machine_5
                                    WHEN 6 THEN plo.Machine_6
                                    WHEN 7 THEN plo.Machine_7
                                    WHEN 8 THEN plo.Machine_8
                                    WHEN 9 THEN plo.Machine_9
                                    WHEN 10 THEN plo.Machine_10
                                    WHEN 11 THEN plo.Machine_11
                                    WHEN 12 THEN plo.Machine_12
                                    WHEN 13 THEN plo.Machine_13
                                    WHEN 14 THEN plo.Machine_14
                                END
                            ))) = 'NG'
                    ) THEN 'NG'
                    ELSE 'OK'
                END
            ELSE NULL
        END,
        Status = CASE
            WHEN Summary = 'OK' THEN 'Complete'
            WHEN Summary = 'NG' THEN 'Warning'
            ELSE 'Working'
        END
    FROM [dbo].[ProcessLineOverview] plo
    INNER JOIN inserted i ON plo.Line_No = i.Line_No
        AND plo.Model_No = i.Model_No
        AND plo.Kind_No = i.Kind_No
        AND ISNULL(plo.DATA_Code1, '') = ISNULL(i.DATA_Code1, '')
        AND ISNULL(plo.DATA_Code2, '') = ISNULL(i.DATA_Code2, '')
        AND ISNULL(plo.DATA_Code3, '') = ISNULL(i.DATA_Code3, '')
    WHERE i.Machine_No = 1;

    -- Update if Machine_No > 1
    -- Future: Use DATA_Code1, DATA_Code2, DATA_Code3 for additional logic or filtering here
    UPDATE plo
    SET 
        Machine_1 = CASE WHEN i.Machine_No = 1 THEN s.Summary ELSE plo.Machine_1 END,
        Machine_2 = CASE WHEN i.Machine_No = 2 THEN s.Summary ELSE plo.Machine_2 END,
        Machine_3 = CASE WHEN i.Machine_No = 3 THEN s.Summary ELSE plo.Machine_3 END,
        Machine_4 = CASE WHEN i.Machine_No = 4 THEN s.Summary ELSE plo.Machine_4 END,
        Machine_5 = CASE WHEN i.Machine_No = 5 THEN s.Summary ELSE plo.Machine_5 END,
        Machine_6 = CASE WHEN i.Machine_No = 6 THEN s.Summary ELSE plo.Machine_6 END,
        Machine_7 = CASE WHEN i.Machine_No = 7 THEN s.Summary ELSE plo.Machine_7 END,
        Machine_8 = CASE WHEN i.Machine_No = 8 THEN s.Summary ELSE plo.Machine_8 END,
        Machine_9 = CASE WHEN i.Machine_No = 9 THEN s.Summary ELSE plo.Machine_9 END,
        Machine_10 = CASE WHEN i.Machine_No = 10 THEN s.Summary ELSE plo.Machine_10 END,
        Machine_11 = CASE WHEN i.Machine_No = 11 THEN s.Summary ELSE plo.Machine_11 END,
        Machine_12 = CASE WHEN i.Machine_No = 12 THEN s.Summary ELSE plo.Machine_12 END,
        Machine_13 = CASE WHEN i.Machine_No = 13 THEN s.Summary ELSE plo.Machine_13 END,
        Machine_14 = CASE WHEN i.Machine_No = 14 THEN s.Summary ELSE plo.Machine_14 END
    FROM [dbo].[ProcessLineOverview] plo
    INNER JOIN inserted i ON plo.Line_No = i.Line_No
    -- AND ISNULL(i.DATA_Code1, '') = ISNULL(plo.DATA_Code1, '')
--AND ISNULL(i.DATA_Code2, '') = ISNULL(plo.DATA_Code2, '')
     -- AND ISNULL(i.DATA_Code3, '') = ISNULL(plo.DATA_Code3, '')
    CROSS APPLY (SELECT
        CASE
            WHEN 
                (UPPER(ISNULL(i.Result1, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result2, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result3, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result4, '')) = 'NG' OR
                 UPPER(ISNULL(i.Result5, '')) = 'NG')
            THEN 'NG'
            WHEN 
                (UPPER(ISNULL(i.Result1, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result2, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result3, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result4, '')) = 'OK' OR
                 UPPER(ISNULL(i.Result5, '')) = 'OK')
            THEN 'OK'
            ELSE NULL
        END AS Summary
    ) s
    WHERE i.Machine_No > 1
     AND ISNULL(i.DATA_Code1, '') = ISNULL(plo.DATA_Code1, '')
   AND ISNULL(i.DATA_Code2, '') = ISNULL(plo.DATA_Code2, '')
     AND ISNULL(i.DATA_Code3, '') = ISNULL(plo.DATA_Code3, '')
      -- (Separation of jobs by DATA_Code1-3)

    -- If this is the last inserted record for the line/model/kind, update the summary
 -- Only update summary when the last machine's result is not NULL
UPDATE plo
SET Summary = 
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM [FTS Traceability].[dbo].[tblMachineMst] m
            WHERE m.Line_No = plo.Line_No
              AND (
                RTRIM(LTRIM(UPPER(
                    CASE m.Machine_No
                        WHEN 1 THEN plo.Machine_1
                        WHEN 2 THEN plo.Machine_2
                        WHEN 3 THEN plo.Machine_3
                        WHEN 4 THEN plo.Machine_4
                        WHEN 5 THEN plo.Machine_5
                        WHEN 6 THEN plo.Machine_6
                        WHEN 7 THEN plo.Machine_7
                        WHEN 8 THEN plo.Machine_8
                        WHEN 9 THEN plo.Machine_9
                        WHEN 10 THEN plo.Machine_10
                        WHEN 11 THEN plo.Machine_11
                        WHEN 12 THEN plo.Machine_12
                        WHEN 13 THEN plo.Machine_13
                        WHEN 14 THEN plo.Machine_14
                    END
                ))) <> 'OK'
                OR
                    CASE m.Machine_No
                        WHEN 1 THEN plo.Machine_1
                        WHEN 2 THEN plo.Machine_2
                        WHEN 3 THEN plo.Machine_3
                        WHEN 4 THEN plo.Machine_4
                        WHEN 5 THEN plo.Machine_5
                        WHEN 6 THEN plo.Machine_6
                        WHEN 7 THEN plo.Machine_7
                        WHEN 8 THEN plo.Machine_8
                        WHEN 9 THEN plo.Machine_9
                        WHEN 10 THEN plo.Machine_10
                        WHEN 11 THEN plo.Machine_11
                        WHEN 12 THEN plo.Machine_12
                        WHEN 13 THEN plo.Machine_13
                        WHEN 14 THEN plo.Machine_14
                    END IS NULL
              )
        )
        THEN 'OK'
        ELSE 'NG'
    END
FROM [dbo].[ProcessLineOverview] plo
WHERE plo.LogID = (
    SELECT TOP 1 p2.LogID
    FROM [dbo].[ProcessLineOverview] p2
    WHERE p2.Line_No = plo.Line_No AND p2.Kind_No = plo.Kind_No AND p2.Model_No = plo.Model_No
    ORDER BY p2.LogID DESC
)
AND
    -- Only update if the last machine's result is not NULL
    (
        SELECT 
            CASE MAX(m.Machine_No)
                WHEN 1 THEN plo.Machine_1
                WHEN 2 THEN plo.Machine_2
                WHEN 3 THEN plo.Machine_3
                WHEN 4 THEN plo.Machine_4
                WHEN 5 THEN plo.Machine_5
                WHEN 6 THEN plo.Machine_6
                WHEN 7 THEN plo.Machine_7
                WHEN 8 THEN plo.Machine_8
                WHEN 9 THEN plo.Machine_9
                WHEN 10 THEN plo.Machine_10
                WHEN 11 THEN plo.Machine_11
                WHEN 12 THEN plo.Machine_12
                WHEN 13 THEN plo.Machine_13
                WHEN 14 THEN plo.Machine_14
            END
        FROM [FTS Traceability].[dbo].[tblMachineMst] m
        WHERE m.Line_No = plo.Line_No
    ) IS NOT NULL;
END
GO
