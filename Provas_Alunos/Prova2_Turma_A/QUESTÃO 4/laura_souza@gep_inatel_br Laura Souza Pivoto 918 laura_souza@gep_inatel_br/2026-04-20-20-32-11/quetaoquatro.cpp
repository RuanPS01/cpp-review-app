#include <iostream>
#include <iomanip>
#include <vector>
#include <cmath>

using namespace std;

int main(){
    
    int positivo = 0;
    int negativo = 0;
    double media = 0;
    
    int numeros[N];
    
    for(int i = 0; i > numeros; i++){
        cin >> numeros[i];
            if(numeros[i] > 0){
                cout << positivos << "positivos" << endl;
                
                cout << fixed << setprecision(3) << endl;
                media = positivo/numeros;
                cout << "media = " << media << endl;
            }
            else if(numeros[i] < 0){
                cout << negativos << "negativos"<< endl;
                
                cout << fixed << setprecision(3) << endl;
                media = negativos/numeros;
                cout << "media = " << media << endl;
                
        }
    }
    return 0;
}