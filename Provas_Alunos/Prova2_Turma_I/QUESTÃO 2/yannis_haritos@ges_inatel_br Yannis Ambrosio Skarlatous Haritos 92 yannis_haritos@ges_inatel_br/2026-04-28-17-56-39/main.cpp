#include<iostream>
#include<iomanip>

using namespace std;

int main(){
    
    int N;
    double altura;
    double baixo = 100;
    double alto = -100;
    
    cin >> N;
    
    for(int i = 0; i < N; i++){
       cin >> altura;
       if( altura > alto){
           alto = altura;
       }
       if( altura < baixo ){
           baixo = altura;
       }
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << baixo << endl;
    cout << "Maior altura: " << alto << endl;
    
    return 0;
}