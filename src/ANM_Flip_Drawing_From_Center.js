/*
	Flip Drawing from Center v1.1
	
	Flip a selected frame of a drawing from center by flipping the frame with a temporally added peg
	and then perform copy & paste in the Camera view to bake the flipping.
	
		v1.1 - This script no longer modifies the current tool, Select tool properties and art layer modes.

	
	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) There is a folder named "src" inside the zip file. Copy all its contents directly to the folder above.
	4) In Harmony, add one or both of the following functions to any toolbar:

	   - ANM_flip_Drawing_From_Center_H()     ---for Horizontal flipping
	   - ANM_flip_Drawing_From_Center_V()     ---for Vertical flipping
	
		
	Direction:

	Select a drawing node you want to flip and then run the script.


	Author:

		Yu Ueda (raindropmoment.com)
*/


// ------------------------------------ Script Begins Here ------------------------------------


function ANM_Flip_Drawing_From_Center_H()
{
	var pf = new private_functions;
	var sNodes = selection.selectedNodes();
	var sNode = selection.selectedNode(0);

	if (sNodes.length < 1 || node.type(sNode) !== "READ")
	{
		MessageBox.information("Please select a drawing before running this script.");
		return;
	}
	
	scene.beginUndoRedoAccum("Flip drawing horizontally from the center");
			
		
	pf.flip(sNode, "horizontal");
			
	
	scene.endUndoRedoAccum();	
}



function ANM_Flip_Drawing_From_Center_V()
{
	var pf = new private_functions;
	var sNodes = selection.selectedNodes();
	var sNode = selection.selectedNode(0);

	if (sNodes.length < 1 || node.type(sNode) !== "READ")
	{
		MessageBox.information("Please select a Drawing node.");
		return;
	}
	
	scene.beginUndoRedoAccum("Flip drawing vertically from the center");		

	
	pf.flip(sNode, "vertical");

	
	scene.endUndoRedoAccum();		
}


function private_functions()
{
	this.getUniqueName = function(argName, group)
	{
		var suffix = 0;
		var originalName = argName;
 
		while (node.getName(group + "/" + argName))
		{
			suffix ++;
			argName = originalName + "_" + suffix;	
		}
	
		return argName;
	};
	
	
	this.addPeg = function(argNode)
	{
		var group = node.parentNode(argNode);		
		var pegName = this.getUniqueName("flipPeg", group);
		var newPeg = node.add(group, pegName, "PEG", 0, 0, 0);
		var srcNode = node.srcNode(argNode, 0);
		
		node.unlink(argNode, 0);
		node.link(srcNode, 0, newPeg, 0);
		node.link(newPeg, 0, argNode, 0);	
		
		return newPeg;
	};
	
	
	this.flip = function(argNode, mode)
	{
		var softwareVer = this.getSoftwareVer();
		var OGSettings = this.captureOGSettingsThenApplyPresets(softwareVer);	
		var OGFrame = frame.current();
		
		// If pivot source is drawing, set to apply on drawing:
		var embeddedPivotOption = node.getTextAttr (argNode, 1, "useDrawingPivot");	
		if (embeddedPivotOption !== "Apply Embedded Pivot on Drawing Layer")
			node.setTextAttr (argNode, "useDrawingPivot", 1, "Apply Embedded Pivot on Drawing Layer");
		
		Action.perform("onActionChooseSelectTool()", "drawingView,cameraView");	


//--------------------------------- Main Function begins --------------------------------------->


		var flipPeg = this.addPeg(argNode);
		DrawingTools.setCurrentDrawingFromNodeName(argNode, frame.current());
		
		if (mode == "horizontal")
			node.setTextAttr(flipPeg, "scale.x", frame.current(), -1);
		else
			node.setTextAttr(flipPeg, "scale.y", frame.current(), -1);
		
		Action.perform("selectAll()", "cameraView");	
		
		// Check selection. If selection is empty, operation ends for the current frame.
		var selectionIsValid = Action.validate("cut()", "cameraView");		
		if (selectionIsValid)
		{
			Action.perform("cut()", "cameraView");
			if (mode == "horizontal")
				node.setTextAttr(flipPeg, "scale.x", frame.current(), 1);
			else
				node.setTextAttr(flipPeg, "scale.y", frame.current(), 1);			
			
			Action.perform("paste()", "cameraView");
		}		
		node.deleteNode(flipPeg, true, true);
		
		
//--------------------------------- Main Function ends --------------------------------------->		
		
		
		// Set embedded pivot option back to original:
		node.setTextAttr (argNode, "useDrawingPivot", 1, embeddedPivotOption);

		this.restoreOGSettings(softwareVer, OGSettings);
		frame.setCurrent(OGFrame);		
	};
	
	
	this.getSoftwareVer = function()
	{
		var info = about.getVersionInfoStr();
		info = info.split(" ");
		return parseFloat(info[7]);
	};	
	
	
	this.captureOGSettingsThenApplyPresets = function(softwareVer)
	{
		// capture current tool, Select tool settings and the art layer mode...
		var settings = this.captureSelectToolSettings(softwareVer);		
		settings.tool = this.captureCurrentTool(softwareVer);
		settings.artLayer = this.captureArtLayerSettings();		
		
		//...and then set the custom settings
		ToolProperties.setMarkeeMode(false);	
		ToolProperties.setSelectByColourMode(false);	
		ToolProperties.setPermanentSelectionMode(false);
		ToolProperties.setApplyAllArts(true);
		
		// if Preview All Art Layers is set on, turn it off
		if (settings.artLayer.boolViewAll)
			Action.perform("onActionPreviewModeToggle()", "artLayerResponder");

		if (softwareVer >= 16)
		{
			settings.frameModeButton.checked = false;
			settings.elementModeButton.checked = false;
		}
		else
		{
			ToolProperties.setApplyAllDrawings(false);	
			settings.syncedDrawingButton.checked = false;
			settings.singleDrawingButton.checked = false;
		}
		return settings;
	};


	this.captureSelectToolSettings = function(softwareVer)
	{
		var settings = {
			boolMarkee: false,
			boolSelectByColor: false,
			boolPermanentSelection:	Action.validate("onActionTogglePermanentSelection()","drawingView").checked,
			boolApplyAllLayers: Action.validate("onActionToggleApplyToolToAllLayers()","drawingView").checked,
			boolSyncedDrawing: false,	syncedDrawingButton: {},
			boolSingleDrawing: false,	singleDrawingButton: {},
			boolElementMode: false,		elementModeButton: {},
			boolFrameMode: false,		frameModeButton: {}
		};	
			
		if (softwareVer < 16)
			settings.boolApplyAllDrawings = Action.validate("onActionToggleApplyToAllDrawings()","drawingView").checked;
			
		var widgets = QApplication.allWidgets();
		for (var w in widgets)
		{
			var widget = widgets[w];
			if (widget.objectName == "SelectProperties")
			{
				var child = widget.children();
				for (var ch in child)
				{
					if (child[ch].objectName == "boxOptions")
					{
						var boxChild = child[ch].children();		
						for (var bx in boxChild)
						{
							if (boxChild[bx].objectName == "frameOptions1")
							{
								var frameChild = boxChild[bx].children();
								for (var fr in frameChild)
								{
									if (frameChild[fr].objectName == "buttonSelectTool" &&
									(frameChild[fr].toolTip == "Lasso" || frameChild[fr].toolTip == "Marquee"))
										settings.boolMarkee = (frameChild[fr].toolTip == "Lasso") ? true : false;
									else if (frameChild[fr].objectName == "buttonSelectByColor")
										settings.boolSelectByColor = frameChild[fr].checked;								
								}
							}
							else if (boxChild[bx].objectName == "frameOptions2")
							{
								var frameChild = boxChild[bx].children();	
								for (var fr in frameChild)
								{
									switch (frameChild[fr].objectName)
									{
										case "buttonElementMode" :
											settings.boolElementMode = frameChild[fr].checked;
											settings.elementModeButton = frameChild[fr]; break;
										case "buttonFrameMode" :
											settings.boolFrameMode = frameChild[fr].checked;										
											settings.frameModeButton = frameChild[fr]; break;
										case "buttonSingleDrawing" :
											settings.boolSingleDrawing = frameChild[fr].checked;										
											settings.singleDrawingButton = frameChild[fr]; break;
										case "buttonApplyLinkedDrawings" :
											settings.boolSyncedDrawing = frameChild[fr].checked;											
											settings.syncedDrawingButton = frameChild[fr];
									}
								}
							}
						}
						break;
					}
				}
				break;				
			}				
		}
		return settings;
	};


	this.captureArtLayerSettings = function()
	{
		var artLayerSettings = {};
		artLayerSettings.boolViewAll = Action.validate("onActionPreviewModeToggle()", "artLayerResponder").checked;
	
		var boolOverlay = Action.validate("onActionOverlayArtSelected()", "artLayerResponder").checked;
		var boolLine = Action.validate("onActionLineArtSelected()", "artLayerResponder").checked;
		var boolColor = Action.validate("onActionColorArtSelected()", "artLayerResponder").checked;

		if (boolOverlay)		artLayerSettings.activeArt = 8;
		else if (boolLine)		artLayerSettings.activeArt = 4;				
		else if (boolColor)	artLayerSettings.activeArt = 2;		
		else /*boolUnderlay*/	artLayerSettings.activeArt = 1;

		return artLayerSettings;
	};
	
	
	this.captureCurrentTool = function(softwareVer)
	{
		if (softwareVer >= 16)	
			return Tools.getToolSettings().currentTool.id;			
		else
		{
			var toolList = [
				"onActionChooseSelectTool()", "onActionChooseCutterTool()", "onActionChooseRepositionAllDrawingsTool()",
				"onActionChooseContourEditorTool()", "onActionChooseCenterlineEditorTool()", "onActionChoosePencilEditorTool()",
				"onActionChooseSpSmoothEditingTool()", "onActionChoosePerspectiveTool()", "onActionChooseEnvelopeTool()",
				"onActionChooseEditTransformTool()", "onActionChooseBrushTool()", "onActionChoosePencilTool()", "onActionChooseTextTool()",
				"onActionChooseEraserTool()", "onActionChoosePaintToolInPaintMode()", "onActionChooseInkTool()",
				"onActionChoosePaintToolInPaintUnpaintedMode()", "onActionChoosePaintToolInRepaintMode()",
				"onActionChoosePaintToolInUnpaintMode()", "onActionChooseStrokeTool()", "onActionChooseCloseGapTool()",
				"onActionChooseLineTool()", "onActionChooseRectangleTool()", "onActionChooseEllipseTool()", "onActionChoosePolylineTool()",
				"onActionChooseDropperTool()", "onActionChoosePivotTool()", "onActionChooseMorphTool()", "onActionChooseGrabberTool()",
				"onActionChooseZoomTool()", "onActionChooseRotateTool()", "onActionChooseSpTransformTool()", "onActionChooseSpInverseKinematicsTool()",
				"onActionChooseSpTranslateTool()", "onActionChooseSpRotateTool()", "onActionChooseSpScaleTool()", "onActionChooseSpSkewTool()",
				"onActionChooseSpMaintainSizeTool()", "onActionChooseSpSplineOffsetTool()", "onActionChooseSpRepositionTool()",
				"onActionChooseSpTransformTool()", "onActionChooseSpInverseKinematicsTool()",
			];	
			for (var tl in toolList)
				if (Action.validate(toolList[tl], "sceneUI").checked)
					return toolList[tl];	
		}
	};
	
	
	this.restoreOGSettings = function(softwareVer, settings)
	{
		if (softwareVer >= 16)	
		{
			Tools.setCurrentTool(settings.tool);
			settings.frameModeButton.checked = settings.boolFrameMode;
			settings.elementModeButton.checked = settings.boolElementMode;		
		}
		else
		{
			Action.perform(settings.tool, "sceneUI");	
			ToolProperties.setApplyAllDrawings(settings.boolApplyAllDrawings);	
			settings.syncedDrawingButton.checked = settings.boolSyncedDrawing;
			settings.singleDrawingButton.checked = settings.boolSingleDrawing;
		}		
		ToolProperties.setMarkeeMode(settings.boolMarkee);	
		ToolProperties.setSelectByColourMode(settings.boolSelectByColor);
		ToolProperties.setPermanentSelectionMode(settings.boolPermanentSelection);
		ToolProperties.setApplyAllArts(settings.boolApplyAllLayers);
		
		DrawingTools.setCurrentArt(settings.artLayer.activeArt);
		if (settings.artLayer.boolViewAll != Action.validate("onActionPreviewModeToggle()", "artLayerResponder").checked)
			Action.perform("onActionPreviewModeToggle()", "artLayerResponder");		
	};
}