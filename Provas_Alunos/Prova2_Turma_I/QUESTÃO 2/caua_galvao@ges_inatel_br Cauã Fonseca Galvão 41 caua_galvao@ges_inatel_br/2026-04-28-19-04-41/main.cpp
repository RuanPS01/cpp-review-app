#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    int pessoa;
    int altura;
    int alturamaior;
    int alturamenor; // altura menor e maior
    
    cin >> pessoa;
    
    for(int i = 0; i <= pessoa; i++){
        cin >> altura;
        
        if(altura <= alturamenor){
            alturamenor ++;
            cout << "menor altura: " <<alturamenor << endl;
        }
        if(altura >= alturamaior){
            alturamaior++;
            cout << "maior altura: " <<alturamaior << endl;
        }
    }
    
    cout << fixed << setprecision(2);
    
    
    return 0;
}