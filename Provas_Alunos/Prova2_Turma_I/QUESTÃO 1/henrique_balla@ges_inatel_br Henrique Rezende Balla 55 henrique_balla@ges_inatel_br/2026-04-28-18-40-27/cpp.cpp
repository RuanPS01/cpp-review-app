#include <iostream>
#include <cmath>
#include <iomanip>
using namespace std;

int main (){
    int N;
    int numeros, quant;
   
    
    cin >> N;
    for (int i = 0; i <= N ; i++){
        cin >> numeros;
        
        if (numeros%3 == 0){ 
          numeros++;
          cout << numeros << endl;  
           
        }
    }
    
    
    
    return 0;
}