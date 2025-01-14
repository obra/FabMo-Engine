var log = require('../../../log').logger('sbp');
var g2 = require('../../../g2');
var sb3_commands = require('../sb3_commands');
var config = require('../../../config');
var interpolate = require('../interpolate');

var tform = require('../transformation');  // need to know about transforms that may require circle interpolation


/* CUTS */
// The primary Cut Commands in ShopBot are for Circle/Arcs and for Rectangles. These Commands have many features historically
//   ... in order to allow a lot of work from the Command Line.
// Here we convert all the Circle/Arc Commnads to expression as CG, which most resembles a g-code arc instruction.



//  The CA Command cuts an arc defined by its cord length, height, and angle from start
//      to end.
//    
exports.CA = function(args) {
  var startX = this.cmd_posx;
  var startY = this.cmd_posy;
  var startZ = this.cmd_posz;
  var len = args[0] !== undefined ? Math.abs(args[0]) : undefined;
  var ht  = args[1] !== undefined ? Math.abs(args[1]) : undefined;
  var inStr = args[2] !== undefined ? args[2].toUpperCase() : 'T';
  var OIT = (inStr === 'O' || inStr === 'I' || inStr === 'T') ? inStr : 'T';
  var Dir = args[3] !== undefined ? args[3] : 1;
  var angle = args[4] !== undefined ? args[4] : undefined;
  var Plg  = args[5] !== undefined ? args[5] : undefined;
  var reps = args[6] !== undefined ? args[6] : 1; 
  var propX = args[7] !== undefined ? args[7] : 1;
  var propY = args[8] !== undefined ? args[8] : 1;
  var tabs = args[9] !== undefined ? args[9] : undefined;
  var noPullUp = args[10] !== undefined ? [10] : 0;
  var plgFromZero = args[11] !== undefined ? args[11] : 0;
  var comp = 0;

  if (OIT === 'O') {
    comp = 1;
  } 
  else if (OIT === 'I') {
    comp = -1;
  }

  var radius = (ht/2) + ((len*len) / (8*ht)) + (config.opensbp.get('cutterDia')/2 * comp);

  if ( radius === undefined || radius <= 0 ){
    throw( "Invalid CA circle: Zero Radius" );
  }

  var xOffset = startX + (len/2);
  var yOffset = startY + (ht - radius);

  var endX = startX + len;
  var endY = startY;

  if (Dir === -1) {
    xOffset *= (-1);
    endX = startX - len;
  }

  this.CG([undefined,endX,endY,xOffset,yOffset,OIT,Dir,Plg,reps,propX,propY,undefined,noPullUp,plgFromZero]);

};


//  The CC Command cuts a circle/arc as defined by its diameter.
//    
//
exports.CC = function(args) {
  var CCstartX = this.cmd_posx;
  var CCstartY = this.cmd_posy;
  var CCstartZ = this.cmd_posz;
  var Dia = args[0] !== undefined ? args[0] : undefined;
  var inStr = args[1] !== undefined ? args[1].toUpperCase() : 'T';
  var OIT = (inStr === 'O' || inStr === 'I' || inStr === 'T') ? inStr : 'T';
  var Dir = args[2] !== undefined ? args[2] : 1;
  var Bang = args[3] !== undefined ? args[3] : 0;
  var Eang = args[4] !== undefined ? args[4] : 0;
  var Plg = args[5] !== undefined ? args[5] : undefined; 
  var reps = args[6] !== undefined ? args[6] : undefined;
  var propX = args[7] !== undefined ? args[7] : undefined;
  var propY = args[8] !== undefined ? args[8] : undefined;
  var optCC = args[9] !== undefined ? args[9] : undefined;
  var noPullUp = args[10] !== undefined ? args[10] : undefined;
  var plgFromZero = args[11] !== undefined ? args[11] : undefined;
  var comp = 0;

  log.debug("CC:   startX = " + CCstartX + "  startY = " + CCstartY + "  startZ = " + CCstartZ );

  if (OIT === 'O') {
    comp = 1;
  } 
  else if (OIT === 'I') {
    comp = -1;
  }
  if ( Dia === undefined || Dia <= 0 ){
    // Error: Zero diameter circle
    throw( "Invalid CC circle: Zero diameter" ); 
  }

  var WBang = 450 - Bang;
  if ( WBang > 360 || WBang === 360 ) { 
    WBang -= 360;
  } 
  else if ( WBang < -360 || WBang === -360 ) {
    WBang += 360;
  }
  var Bradians = WBang*0.01745329252;

  var WEang = 450 - Eang;
  if ( WEang > 360 || WEang === 360 ) { 
    WEang -= 360;
  }
  else if ( WEang < -360 || WEang === -360 ) {
    WEang += 360;
  }
  var Eradians = WEang*0.01745329252;

  // Find Center offset
  var radius = Dia/2 + (config.opensbp.get('cutterDia')/2 * comp);
  var centerX = CCstartX + (radius * Math.cos(Bradians + Math.PI));
  var centerY = CCstartY + (radius * Math.sin(Bradians + Math.PI));
  var xOffset = centerX - CCstartX;
  var yOffset = centerY - CCstartY;
  var endX;
  var endY;

  // Find End point
  if ( Bang === Eang ){
    endX = CCstartX;
    endY = CCstartY;
  }
  else {
    endX = centerX + radius * Math.cos(Eradians);
    endY = centerY + radius * Math.sin(Eradians);
  }

  this.CG([undefined,endX,endY,xOffset,yOffset,OIT,Dir,Plg,reps,propX,propY,optCC,noPullUp,plgFromZero]);

};


//  The CP command will cut a circle as defined by its center point.
//    
//
exports.CP = function(args) {
  var CPstartZ = this.cmd_posz;
  var Dia = args[0] !== undefined ? args[0] : undefined;
  var centerX = args[1] !== undefined ? args[1] : this.cmd_posx;
  var centerY = args[2] !== undefined ? args[2] : this.cmd_posy;
  var inStr = args[3] !== undefined ? args[3].toUpperCase() : 'T';
  var OIT = (inStr === 'O' || inStr === 'I' || inStr === 'T') ? inStr : 'T';
  var Dir = args[4] !== undefined ? args[4] : 1;
  var Bang = args[5] !== undefined ? args[5] : 0; 
  var Eang = args[6] !== undefined ? args[6] : 0;
  var Plg = args[7] !== undefined ? args[7] : undefined;
  var reps = args[8] !== undefined ? args[8] : undefined;
  var propX = args[9] !== undefined ? args[9] : undefined;
  var propY = args[10] !== undefined ? args[10] : undefined;
  var optCP = args[11] !== undefined ? args[11] : undefined;
  var noPullUp = args[12] !== undefined ? args[12] : undefined;
  var plgFromZero = args[13] !== undefined ? args[13] : undefined;
  var res = 5;
  var comp = 0;
  var feedrate = 0;

  log.debug("CP: " + JSON.stringify(args));
  
  if (OIT === 'O') { comp = 1; } 
  else if (OIT === 'I') { comp = -1; }

  if ( Dia === undefined || Dia <= 0 ){
    throw( "Zero diameter circle: CC" );
  }

  var WBang = 450 - Bang;
  if ( WBang > 360 || WBang === 360 ) { WBang -= 360; } 
  else if ( WBang < -360 || WBang === -360 ) { WBang += 360; }
  var Bradians = WBang*0.01745329252;

  var WEang = 450 - Eang;
  if ( WEang > 360 || WEang === 360 ) { WEang -= 360; }
  else if ( WEang < -360 || WEang === -360 ) { WEang += 360; }
  var Eradians = WEang*0.01745329252;

  // Find Center offset
  var radius = Dia/2 + (config.opensbp.get('cutterDia')/2 * comp);
  var CPstartX = centerX + (radius * Math.cos(Bradians));
  var CPstartY = centerY + (radius * Math.sin(Bradians));
  var xOffset = 0;
  if ( Bang !== 0 && Bang !== 180 ) { xOffset = centerX - CPstartX; }
  var yOffset = 0;
  if ( Eang !== 90 && Eang != 270 ) { yOffset = centerY - CPstartY; }

  // Find End point
  var endX = centerX + (radius * Math.cos(Eradians));
  var endY = centerY + (radius * Math.sin(Eradians));

  // Move to Start position if not already there
  if( this.cmd_posx !== CPstartX || this.cmd_posy !== CPstartY ){
    feedrate = this.movespeed_xy * 60;
    var safeZ = config.opensbp.get('safeZpullUp');
    if( CPstartZ < safeZ && this.lastNoZPullup !== 1 ){
      this.emit_move('G0',{'Z':safeZ,'F':feedrate});
      this.emit_move('G0',{'X':CPstartX,'Y':CPstartY});
    }
    else {
      this.emit_move('G0',{'X':CPstartX,'Y':CPstartY});
    }
    if( this.cmd_posz !== CPstartZ && this.lastNoZPullup !== 1 ){
      this.emit_move('G1',{'Z':CPstartZ,'F':feedrate});
    }
  }
  this.CG([undefined,endX,endY,xOffset,yOffset,OIT,Dir,Plg,reps,propX,propY,optCP,noPullUp,plgFromZero]);

};


//	The CG command will cut a circle. This command closely resembles a G-code arc/circle (G02 or G03)
//  Notably, this command has several added features that its G-code counterparts don't:
//	  - Spiral plunge with multiple passes
//	  - Pocketing
//	  - Pocketing with multiple passes
//    - Independent scaling of X/Y to create eliptical shapes; done from the command or as a transform, using interpolation
//	Can also be used for Arcs and Arcs with multiple passes
//		
exports.CG = function(args) {    // note extensive parameter list; see OpenSBP Command Ref
  var CGstartX = this.cmd_StartX; 
  var CGstartY = this.cmd_StartY;
  var CGstartZ = this.cmd_StartZ;  // *track current value; but make sure there is a value!
  if (this.cmd_posx !== undefined) CGstartX = this.cmd_StartX = this.cmd_posx;
  if (this.cmd_posy !== undefined) CGstartY = this.cmd_StartY = this.cmd_posy;
  if (this.cmd_posz !== undefined) CGstartZ = this.cmd_StartZ = this.cmd_posz;

  var endX = args[1] !== undefined ? args[1] : undefined;
  var endY = args[2] !== undefined ? args[2] : undefined;
  var centerX = args[3] !== undefined ? args[3] : undefined;
  var centerY = args[4] !== undefined ? args[4] : undefined;
  var inStr = args[5] !== undefined ? args[5].toUpperCase() : 'T';
  var OIT = (inStr === 'O' || inStr === 'I' || inStr === 'T') ? inStr : 'T';
  var Dir = args[6] !== undefined ? args[6] : 1; 
  var Plg = args[7] !== undefined ? args[7] : 0;
  var reps = args[8] !== undefined ? args[8] : 1;
  var propX = args[9] !== undefined ? args[9] : 1;
  var propY = args[10] !== undefined ? args[10] : 1;
  var optCG = args[11] !== undefined ? args[11] : 0;      // additional CG functions: 1={tabOBS}, 2=pocket, 3=spiral , 4=spiral+bottom
  var noPullUp = args[12] !== undefined ? args[12] : 0;
  var plgFromZero = args[13] !== undefined ? args[13] : 0;
  
  var feedrateXY = this.movespeed_xy * 60;
  var feedrateZ = this.movespeed_z * 60;
  var currentZ;
  var outStr;
  var tolerance = 0.000001;
  var Pocket_StepX = 0;
  var Pocket_StepY = 0;
  var PocketAngle = 0;
  var j = 0;

  var forceInterpolation = false;

  log.debug("CG: " + JSON.stringify(args));
                                                        // INTERPOLATION FOR ARCS decided here
  if ( Math.abs(propX) !== Math.abs(propY) ) {          // DO we need interpolation because of circle shape in command itself?
    log.debug("We need INTERPOLATION for specific circle!");
    forceInterpolation = true;
  } else if (this.transforms != null) {                 // OR, doe we need interpolation because of general TRANSFORM active?
    if (this.transforms.scale.apply != false || this.transforms.shearx.apply != false || this.transforms.sheary.apply != false || this.transforms.level.apply != false) {
        log.debug("We need INTERPOLATION!");
        forceInterpolation = true;
    }
  }

  this.lastNoZPullup = plgFromZero;

  if ((centerX === 0 || centerX === undefined) && (centerY === 0 || centerY === undefined)){
    throw( "Invalid CG circle: Zero diameter" );
  }

  if ((propX < 0 && propY > 0) || (propX > 0 && propY < 0 )) { // ... mirroring?
    Dir *= (-1);
  }

  if (propX === propY){                                 // If X & Y are equal proportion, potentially calc new scaled points for non-interpolated
    if (propX !== 1 || propY !== 1) {
      endX = CGstartX + (centerX * Math.abs(propX)) + ((endX - (CGstartX + centerX)) * Math.abs(propX));
      endY = CGstartY + (centerY * Math.abs(propY)) + ((endY - (CGstartY + centerY)) * Math.abs(propY));
      centerX *= Math.abs(propX);
      centerY *= Math.abs(propY);
      if (propX < 0) { 
        endX = CGstartX + (CGstartX-endX);
        centerX *= (-1); 
      }
      if (propY < 0) { 
        endY = CGstartY + (CGstartY-endY);
        centerY *= (-1); 
      }
    }
  }
  
  currentZ = CGstartZ;
  var safeZCG = config.opensbp.get('safeZpullUp');
  
  var spiralPlunge = (optCG === 2 || optCG === 3 || optCG === 4) ? 1 : 0;

  if ( plgFromZero == 1 && currentZ !== 0 ) {	        // If plunge depth is a specified move to that depth 
    currentZ = 0;
    this.emit_move('G0',{ 'Z':currentZ });
  }

  var nextX = 0;
  var nextY = 0;

  for (var i=0; i<reps;i++){
  	if (Plg !== 0 && optCG < 3 ) {                      // If plunge depth is specified move to that depth * number of reps
  		currentZ += Plg;
      this.emit_move('G1',{ 'Z':currentZ, 'F':feedrateZ });
   	}  
   	if (optCG === 2) { 	                                // If Pocketing: Pocket circle from the outside inward to center
        circRadius = Math.sqrt((centerX * centerX) + (centerY * centerY));
        PocketAngle = Math.atan2(centerY, centerX);			
        stepOver = config.opensbp.get('cutterDia') * ((100 - config.opensbp.get('pocketOverlap')) / 100);
        Pocket_StepX = stepOver * Math.cos(PocketAngle);
        Pocket_StepY = stepOver * Math.sin(PocketAngle);

        for (j=0; (Math.abs(Pocket_StepX * j) < circRadius) && (Math.abs(Pocket_StepY * j) < circRadius) ; j++){
            nextX = (CGstartX + (j*Pocket_StepX));
            nextY = (CGstartY + (j*Pocket_StepY));
            if ( j > 0 ) {
                this.emit_move('G1',{ 'X':nextX, 'Y':nextY, 'F':feedrateXY });
            }
            if ( forceInterpolation ) {                 //  -- interpolated pocket
                this.interpolate_circle(nextX,nextY,currentZ,endX,endY,Plg,(centerX - (j*Pocket_StepX)),(centerY - (j*Pocket_StepY)),propX,propY,Dir,optCG );
            } 
            else {                                      //  -- normal pocket 
                if ( Dir === 1 ) { outStr = 'G2'; }	    // clockwise circle/arc
                else { outStr = 'G3'; }	                // counterClockwise circle/arc
                this.emit_move(outStr,{ 'X':nextX,
                                        'Y':nextY,
                                        'I':(centerX - (j*Pocket_StepX)),
                                        'J':(centerY - (j*Pocket_StepY)),
                                        'F':feedrateXY });
            }										
        }                                               // ... end pocketing loop

        this.emit_move('G0',{'Z':safeZCG});
        this.emit_move('G0',{ 'X':CGstartX, 'Y':CGstartY });
    } 
    else {                                              // If not pocketing

        if ( forceInterpolation ) {                     //  -- interpolated arc
            this.interpolate_circle(CGstartX,CGstartY,currentZ,endX,endY,Plg,centerX,centerY,propX,propY,Dir);
        }
        else {                                          //  -- Just a NORMAL UNIFORM MOVE USING ARCS
            var emitObj = {};
            if (Dir === 1 ) { 
              outStr = 'G2';
            }	// Clockwise circle/arc
            else { 
              outStr = 'G3';
            }	// CounterClockwise circle/arc
            emitObj.X = endX;
            emitObj.Y = endY;
            emitObj.I = centerX;
            emitObj.J = centerY;
            if (Plg !== 0 && optCG > 2 ) { 
              currentZ += Plg;
              emitObj.Z = currentZ; 
            } // Add Z for spiral plunge
            emitObj.F = feedrateXY;
            this.emit_move(outStr,emitObj);
                
            if( i+1 < reps && ( endX != CGstartX || endY != CGstartY ) ){	//If an arc, pullup and jog back to the start position
                if ( this.cmd_posz != safeZCG ) {
                    this.emit_move('G0',{'Z':safeZCG});
                }
                this.emit_move('G0',{ 'X':CGstartX, 'Y':CGstartY });
            }
	  }
    }
  }

  ////** Pocketing final pass not impemented for non-uniform
  if (optCG === 4 ) { // Add bottom circle if spiral with bottom clr is specified
    if( endX != CGstartX || endY != CGstartY ) {	//If an arc, pullup and jog back to the start position
      this.emit_move('G0',{'Z':safeZCG});
      this.emit_move('G0',{ 'X':CGstartX, 'Y':CGstartY });
      this.emit_move('G1',{ 'Z':currentZ, 'F':feedrateZ });
    }
    if ( Math.abs(propX) !== Math.abs(propY) ) {      // calculate out to an interpolated ellipse

    }
    else {
      if (Dir === 1 ){ outStr = "G2"; } 		// Clockwise circle/arc
      else { outStr = "G3"; }					// CounterClockwise circle/arc
        this.emit_move(outStr,{ 'X':(CGstartX + (j*Pocket_StepX)),
                                'Y':(CGstartY + (j*Pocket_StepY)),
                                'I':(centerX - (j*Pocket_StepX)),
                                'J':(centerY - (j*Pocket_StepY)),
                                'F':feedrateXY });
    }
  }

  if( noPullUp === 0 && currentZ !== CGstartZ){    	//If No pull-up is set to YES, pull up to the starting Z location
    this.emit_move('G0',{'Z':CGstartZ});
  }

};


//  Interpolate_Circle - is a HELPER for adding interpolated segments to non-uniform circle/arcs outputting g1 moves as needed
//   ... its use is determined for all possible cases at start of CG, the universal final path for arcs and circles 
//
exports.interpolate_circle = function(ICstartX,ICstartY,ICstartZ,endX,endY,plunge,centerX,centerY,propX,propY,Dir,opt) {

  var nextX = ICstartX;
  var nextY = ICstartY;
  var nextZ = ICstartZ;
  var spiralPlunge = 0;

  if (opt === 3 || opt === 4) {spiralPlunge = 1};
  if (plunge === 0) {spiralPlunge = 0};

  var radius = Math.sqrt(Math.pow((centerX),2)+Math.pow((centerY),2));
  centerX *= propX;
  centerY *= propY; 
  
  // Find the beginning and ending angles in radians. We'll use only radians from here on.
  var Bang = Math.atan2(-1 * centerX, -1 * centerY);
  var Eang = Math.atan2((endX * propX)-(ICstartX + centerX), (endY * propY)-(ICstartY + centerY));
  var inclAng = 0.0;

  // Circle test
  if ((Math.abs(nextX-endX) <= 0.000001) && (Math.abs(nextY-endY) <= 0.000001)) {
    if (Dir === 1) {Eang = Bang + 6.28318530717959} else {Eang = Bang - 6.28318530717959}
  }

  // Get included angle
  if (Dir === 1) {
    if (Bang < Eang) { inclAng = Eang - Bang; }
    if (Bang > Eang) { inclAng = 6.28318530717959 - Bang + Eang; }
  }
  else {
    if (Bang < Eang) { inclAng = 6.28318530717959 - Eang + Bang; }
    if (Bang > Eang) { inclAng = Bang - Eang; }
  }

  if ( inclAng < 0.00001 ) {return} // inclAng = Distr  ////##?? bail here  ??  
  
  var incrAng = 0.05;
  if (incrAng > inclAng) { 
      incrAng = 0.25 * inclAng
  }
  
  var t = Bang   // now a moving computed angle starts at beginning

  var FirstCircleX = radius * Math.sin(t) * propX;
  var FirstCricleY = radius * Math.cos(t) * propY; 
  
  var Xfactor1 = radius * propX;
  var Yfactor1 = radius * propY;
  var Xfactor2 = ICstartX - FirstCircleX;
  var Yfactor2 = ICstartY - FirstCricleY;

  if (incrAng > inclAng) { incrAng = inclAng; };

//========================================================   circle pt generation loop
    var done = false;
    var lastPass = false;
    var complAng = 0;     // completed angle accumulator; use to define last segment for last pass, and done
    do {

        nextX = Xfactor1 * (Math.sin( t + (incrAng * Dir))) + Xfactor2; 
        nextY = Yfactor1 * (Math.cos( t + (incrAng * Dir))) + Yfactor2;

        var incrDist = Math.sqrt(Math.pow((nextX-ICstartX),2)+Math.pow((nextY-ICstartY),2));
        var circRes = config.opensbp.get('cRes');

        var DistA = nextX - ICstartX;
        var DistB = nextY - ICstartY;
        FirstDist = Math.sqrt(Math.pow(DistA,2) + Math.pow(DistB,2));

        if ( FirstDist === 0 ) {
            if ( incrAng === 0 ) {
              incrAng = 0.01;
              continue; // if initial too small, go to next segment (not sure an issue anymore)
            }
        }

        if (spiralPlunge) {
        //    incrAng *= config.opensbp.get('cRes') / FirstDist;

            incrZ = plunge * (complAng / inclAng);
           nextZ = ICstartZ + incrZ;    
        } else {
            nextZ = ICstartZ + plunge;
        }

        // log.debug( " Interpolate - Next Point: " + JSON.stringify(args));
        var feedrate = this.movespeed_xy * 60;
        this.emit_move('G1',{"X":nextX,"Y":nextY,"Z":nextZ, 'F':feedrate});
        
        if (!lastPass) {
            t = t + (incrAng * Dir);
            complAng = complAng + incrAng;
            if ((inclAng - complAng) < 1.01 * incrAng) {
                incrAng = inclAng - complAng;
                lastPass = true;
                complAng = inclAng;
            }
        } else {
            done = true;
        };

    } while (!done);
//======================================================================================    

};


//	The CR command will cut a rectangle. It will generate the necessary G-code to profile and
//		pocket a rectangle. The features include:
//			- Spiral plunge with multiple passes
//			- Pocketing
//			- Pocketing with multiple passes
//			- Rotation around the starting point
//          - Define by center start point
//		
exports.CR = function(args) {
	//calc and output commands to cut a rectangle
  var n = 0.0;
	var CRstartX = this.cmd_posx;
  var CRstartY = this.cmd_posy;
  var CRstartZ = this.cmd_posz;
  var pckt_startX = CRstartX;
  var pckt_startY = CRstartY; 
  var currentZ = CRstartZ;
  var xDir = 1;
  var yDir = 1;

  var lenX = args[0] !== undefined ? args[0] : undefined; 	// X length
  var lenY = args[1] !== undefined ? args[1] : undefined;		// Y length
  var inStr = args[2] !== undefined ? args[2].toUpperCase() : "T";
  var OIT = (inStr === "O" || inStr === "I" || inStr === "T") ? inStr : "T"; // Cutter compentsation (I=inside, T=no comp, O=outside)
  var Dir = args[3] !== undefined ? args[3] : 1;  // Direction of cut (-1=CCW, 1=CW)
  var stCorner = args[4] !== undefined ? args[4] : 4;  // Start Corner - default is 4, the bottom left corner. 0=Center
  var Plg = args[5] !== undefined ? args[5] : 0.0;  // Plunge depth per repetition
  var reps = args[6] !== undefined ? args[6] : 1;  // Repetions
  var optCR = args[7] !== undefined ? args[7] : 0;  // Options - 1-Tab, 2-Pocket Outside-In, 3-Pocket Inside-Out
  var plgFromZero = args[8] !== undefined ? args[8] : 0;  // Start Plunge from Zero <0-NO, 1-YES>
  var RotationAngle = args[9] !== undefined ? args[9] : 0.0;  // Angle to rotate rectangle around starting point
  var PlgAxis = args[10] !== undefined ? args[10] : 'Z';  // Axis to plunge <Z or A>
  var spiralPlg = args[11] !== undefined ? args[11] : 0;  // Turn spiral plunge ON for first pass (0=OFF, 1=ON)
  var xCenter =  args[12] !== undefined ? args[12] : undefined;  // X center coordinate
  var yCenter = args[13] !== undefined ? args[13] : undefined;  // Y center coordinate

  var PlgSp = 0.0;
  var noPullUp = 0;
  var cosRA = 0.0;
  var sinRA = 0.0;
  var stepOver = 0.0;
  var pckt_offsetX = 0.0;
  var pckt_offsetY = 0.0;    
  var order = [1,2,3,4];
  var pckt_stepX = 0.0;
  var pckt_stepY = 0.0;
  var steps = 1.0;
  var rotPtX = pckt_startX;  // Rotation point X
  var rotPtY = pckt_startY;  // Rotation point Y

  var feedrateXY = this.movespeed_xy * 60;
  var feedrateZ = this.movespeed_xy * 60;

  // Set Order and directions based on starting corner
  if ( stCorner == 1 ) { 
    yDir = -1;
    if ( Dir == -1 ) { 
      order = [3,2,1,4]; 
    }
  } 
  else if ( stCorner == 2 ) {
    xDir = -1;
    yDir = -1;
    if ( Dir == 1 ) { 
      order = [3,2,1,4]; 
    }
  }
  else if ( stCorner == 3 ) { 
    xDir = -1; 
    if ( Dir == -1 ) {
      order = [3,2,1,4]; 
    }
  }
  else { 
    if ( Dir == 1 ) {
      order = [3,2,1,4]; 
    }
  }

  if ( OIT == "O" ) { 
    lenX += config.opensbp.get('cutterDia') * xDir;
    lenY += config.opensbp.get('cutterDia') * yDir;
  }
  else if ( OIT == "I" ) {
    lenX -= config.opensbp.get('cutterDia') * xDir;
    lenY -= config.opensbp.get('cutterDia') * yDir;
  }
  else {
    lenX *= xDir;
    lenY *= yDir;
  }

  if ( stCorner === 0 ) {
    pckt_startX = xCenter - (lenX/2);
    pckt_startY = yCenter - (lenY/2);        
  }

  if (RotationAngle !== 0 ) { 
   	RotationAngle *= 0.01745329252;  // Rotation angle in degrees to radians
   	cosRA = Math.cos(RotationAngle); // Cosine of the rotation angle
   	sinRA = Math.sin(RotationAngle); // Sine of the rotation angle
    if ( stCorner !== 0 ) {
      rotPtX = xCenter;  // Rotation point X
      rotPtY = yCenter;  // Rotation point Y

    }
  }
    
  if (Plg !== 0 && plgFromZero === 1){ currentZ = 0; }
  else{ currentZ = CRstartZ; }
  var safeZCR = currentZ + config.opensbp.get('safeZpullUp');

  // Jog to the start position if not already there
  if ( stCorner === 0 && ( CRstartX !== pckt_startX || CRstartY !== pckt_startY )){
    if( currentZ < safeZCR && this.lastNoZPullup !== 1 ){
      this.emit_move('G0',{'Z':safeZCR});
    }
    if ( RotationAngle === 0.0 ) { 
        outStr = "G0X" + nextX + "Y" + nextY;
    }
    else {
      outStr = "G0X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4)+
                 "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
    }
    if ( RotationAngle !== 0 ) {
      pckt_startX = ((pckt_startX*cosRA)-(pckt_startY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA));
      pckt_startY = ((pckt_startX*sinRA)+(pckt_startY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA));
    }   
    this.emit_gcode( outStr);
    if( this.cmd_posz !== currentZ && this.lastNoZPullup !== 1 ){
      this.emit_move('G1',{'Z':currentZ,'F':feedrateZ});
    }
  }

	// If a pocket, calculate the step over and number of steps to pocket out the complete rectangle.
  if (optCR > 1) {
    // Calculate the overlap distacne
   	stepOver = config.opensbp.get('cutterDia') * ((100 - config.opensbp.get('pocketOverlap')) / 100);
   	pckt_stepX = pckt_stepY = stepOver;
  	pckt_stepX *= xDir;
  	pckt_stepY *= yDir;
   	// Base the number of steps on the short side of the rectangle.
	 	if ( Math.abs(lenX) < Math.abs(lenY) ) {
	 		steps = Math.floor((Math.abs(lenX)/2)/Math.abs(stepOver)) + 1; 
	 	}
	 	else {	// If a square or the X is shorter, use the X length.
	 		steps = Math.floor((Math.abs(lenY)/2)/Math.abs(stepOver)) + 1; 
	 	}   		
	  // If an inside-out pocket, reverse the step over direction and find the pocket start point near the center
    if ( optCR === 3 ) {
      pckt_stepX *= (-1);
      pckt_stepY *= (-1);
      pckt_offsetX = stepOver * (steps - 1) * xDir;
      pckt_offsetY = stepOver * (steps - 1) * yDir;

      nextX = pckt_startX + pckt_offsetX;
      nextY = pckt_startY + pckt_offsetY;

      if ( RotationAngle === 0.0 ) { 
		    outStr = "G0X" + nextX + "Y" + nextY;
      }
      else {
		    outStr = "G0X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
			    		     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
      }
      this.emit_gcode( outStr);
    }
  }

  // If an inside-out pocket, move to the start point of the pocket
  if ( optCR == 3 || stCorner === 0 ) {
    this.emit_gcode( "G0Z" + safeZCR );

    nextX = pckt_startX + pckt_offsetX;
    nextY = pckt_startY + pckt_offsetY;

		if ( RotationAngle === 0.0 ) { 
			outStr = "G1X" + nextX + "Y" + nextY;
		}
		else {
			outStr = "G1X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
						     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
		}
    this.emit_gcode( "G1Z" + CRstartZ + "F" + feedrateZ );
    this.emit_gcode( outStr );
  }

  for (i = 0; i < reps; i++) {  
   	if ( spiralPlg != 1 ) {								// If plunge depth is specified move to that depth * number of reps
    	currentZ += Plg;
    	this.emit_gcode( "G1Z" + currentZ + "F" + feedrateZ );    		
    }
    else {
    	this.emit_gcode( "G1Z" + currentZ + "F" + feedrateZ );    		
    }
    	
    pass = cnt = 0;
    var nextX = 0.0;
    var nextY = 0.0;

    for ( j = 0; j < steps; j++ ){
   		do {
	   		for ( k=0; k<4; k++ ){
	   			n = order[k];
	   			switch (n){
	   				case 1:
    				  nextX = (pckt_startX + lenX - pckt_offsetX) - (pckt_stepX * j);
    					nextY = (pckt_startY + pckt_offsetY) + (pckt_stepY * j);
    						
    					if ( RotationAngle === 0.0 ) { 
    						outStr = "G1X" + nextX + "Y" + nextY;
    					}
    					else {
    						outStr = "G1X"+((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
    									     "Y"+((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
    					}
    						
    					if ( spiralPlg == 1 && pass === 0 ) {
    						PlgSp = currentZ + (Plg * 0.25); 
    						outStr += "Z" + (PlgSp).toFixed(4);
    					}
    						
    					outStr += "F" + feedrateXY;
    					this.emit_gcode (outStr);
    				break;

    				case 2:
   						nextX = (pckt_startX + lenX - pckt_offsetX) - (pckt_stepX * j);
   						nextY = (pckt_startY + lenY - pckt_offsetY) - (pckt_stepY * j);

    					if ( RotationAngle === 0.0 ) { 
    						outStr = "G1X" + nextX + "Y" + nextY;
    					}	
   						else {
   							outStr = "G1X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
   										     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
   						}

   						if ( spiralPlg === 1 && pass === 0 ) { 
   							PlgSp = currentZ + (Plg * 0.5);	
   							outStr += "Z" + (PlgSp).toFixed(4);
   						}

   						outStr += "F" + feedrateXY;
    					this.emit_gcode (outStr);
   					break;

   					case 3:
   						nextX = (pckt_startX + pckt_offsetX) + (pckt_stepX * j);
   						nextY = (pckt_startY + lenY - pckt_offsetY) - (pckt_stepY * j);

    					if ( RotationAngle === 0.0 ) { 
    						outStr = "G1X" + nextX + "Y" + nextY;
    					}
   						else {
   							outStr = "G1X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
   										     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
   						}

   						if ( spiralPlg == 1 && pass === 0 ) { 
   							plgSp = currentZ + (Plg * 0.75);	
   							outStr += "Z" + (PlgSp).toFixed(4); 
   						}	

   						outStr += "F" + feedrateXY;
    					this.emit_gcode (outStr);
    				break;

    				case 4:
   						nextX = (pckt_startX + pckt_offsetX) + (pckt_stepX * j);
   						nextY = (pckt_startY + pckt_offsetY) + (pckt_stepY * j);

    					if ( RotationAngle === 0.0 ) { 
    						outStr = "G1X" + nextX + "Y" + nextY;
    					}
   						else {
   							outStr = "G1X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
   										     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
   						}

   						if ( spiralPlg === 1 && pass === 0 ) {
   							currentZ += Plg; 
   							outStr += "Z" + (currentZ).toFixed(4);
                pass = 1;
                if ( i+1 < reps ){
								  cnt = 1;
                } 
   						}
   						else { 
   							cnt = 1;
   						}

   						outStr += "F" + feedrateXY;
   						this.emit_gcode (outStr);
   					break;

   					default:
   						throw "Unhandled operation: " + expr.op;
   				}
   			}
			} while ( cnt < 1 );
  
			if ( (j + 1) < steps && optCR > 1 ) {
				nextX = (pckt_startX + pckt_offsetX) + (pckt_stepX * (j+1));
   			nextY = (pckt_startY + pckt_offsetY) + (pckt_stepY * (j+1));
				if ( RotationAngle === 0 ) { 
			  	outStr = "G1X" + nextX + 
   							   "Y" + nextY;
   			}
   			else {
   				outStr = "G1X" + ((nextX*cosRA)-(nextY*sinRA)+(rotPtX*(1-cosRA))+(rotPtY*sinRA)).toFixed(4) +
   							     "Y" + ((nextX*sinRA)+(nextY*cosRA)+(rotPtX*(1-cosRA))-(rotPtY*sinRA)).toFixed(4); 
   			}
   			outStr += "F" + feedrateXY;
    		this.emit_gcode (outStr);
   		}
   	}

   	// If a pocket, move to the start point of the pocket
	  if ( optCR > 1 || stCorner === 0 ) {
    	this.emit_gcode( "G0Z" + safeZCR );
    	outStr = "G1X" + CRstartX + "Y" + CRstartY;
			outStr += "F" + feedrateXY;
     	this.emit_gcode( outStr );
     	if ( ( i + 1 ) < reps ) { 
     		this.emit_gcode( "G1Z" + currentZ ); 
     	}
   	}
  }
  //If No pull-up is set to YES, pull up to the starting Z location
  if( noPullUp === 0 && currentZ !== CRstartZ ){    
    this.emit_gcode( "G0Z" + CRstartZ);
  }

  if ( optCR === 3 ) {
    this.emit_gcode( "G0X" + CRstartX + "Y" + CRstartY );
  }
};
